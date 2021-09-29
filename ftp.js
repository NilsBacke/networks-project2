const net = require('net')
const tls = require('tls')
const fs = require('fs')
const URL = require('url').URL

const DEFAULT_PORT = 21
const DEFAULT_USERNAME = 'anonymous'
const LS = 'ls'
const MKDIR = 'mkdir'
const RM = 'rm'
const RMDIR = 'rmdir'
const CP = 'cp'
const MV = 'mv'

const run = (command, arg1, arg2, arg1IsRemote, callback) => {
	const localFilePath = arg1IsRemote ? arg2 : arg1
	let isUpload = (command === CP || command === MV) && !arg1IsRemote
	let isDownload = (command === CP || command === MV) && arg1IsRemote

	// parse url
	// gathered from this tutorial https://dmitripavlutin.com/parse-url-javascript/
	const url = new URL(arg1IsRemote ? arg1 : arg2)

	const port = url.port || DEFAULT_PORT
	const username = url.username || DEFAULT_USERNAME
	const password = url.password || ''
	const host = url.host
	const path = url.pathname.slice(1)

	let dataChannelClient = new net.Socket()

	// extract the status code from the server's response
	const parseResponseCode = (respString) => {
		return respString.split(' ')[0]
	}

	// create the new socket for the data channel
	const openDataChannel = (ip, port) => {
		dataChannelClient = dataChannelClient.connect(port, ip, () => {
			waitingForCommandResponse = true
		})
	}

	// send the appropriate command to the server if the command given was 'cp'
	const handleCopyControlChannel = (client) => {
		if (arg1IsRemote) {
			// download from arg1
			client.write(`RETR ${path}\r\n`)
		} else {
			// upload to arg2
			client.write(`STOR ${path}\r\n`)
		}
	}

	// handle uploading a local file to the server
	const handleUpload = (client) => {
		const fileStream = fs.createReadStream(localFilePath)

		// fileStream code gathered from this tutorial https://stackoverflow.com/questions/40877535/socket-io-stream-error-stream-has-already-been-sent
		fileStream.on('error', (err) => {
			console.log('error reading local file for upload', err)
		})

		fileStream.on('open', () => {
			fileStream.pipe(client)
		})
	}

	// handle downloading a file from the server
	const handleDownload = (client) => {
		const fileStream = fs.createWriteStream(localFilePath)
		const handleData = (chunk) => {
			fileStream.write(chunk)
		}
		client.on('data', handleData)
		if (command === MV) {
			command = RM
			isUpload = false
			isDownload = false
		}
	}

	// perform command based on the command line arguments given
	const performCommand = (client) => {
		if (command === MKDIR) {
			client.write(`MKD ${path}\r\n`)
			madeDirectoryOperation = true
		} else if (command === RMDIR) {
			client.write(`RMD ${path}\r\n`)
			madeDirectoryOperation = true
		} else {
			client.write(`PASV\r\n`)
		}
	}

	let waitingForAuthResponse = false // true if we sent the 'AUTH' command
	let waitingForCommandResponse = false // true if we just opened the data channel
	let waitingForDataChannelComplete = false // true if the control channel responded with a "1**"
	let madeDirectoryOperation = false // true if we just made the 'MKD' or 'RMD' command to the control channel

	// handle the data from the control channel
	const onData = (data) => {
		// handle error
		if (parseResponseCode(data.toString()).startsWith('4') || parseResponseCode(data.toString()).startsWith('5')) {
			console.log(data.toString())
			dataChannelClient && dataChannelClient.destroy()
			client.destroy()
		}

		// handle successful end of program
		if (
			(madeDirectoryOperation ||
				waitingForDataChannelComplete ||
				data.toString().trim() === '250 Delete operation successful.') &&
			data.toString().trim().startsWith('2')
		) {
			if (command === MV && isUpload) {
				// delete local file
				fs.unlink(localFilePath, (err) => {
					if (err) console.log('error deleting local file', err)
				})
			}
			callback && callback()
			dataChannelClient && dataChannelClient.destroy()
			client.destroy()
		}

		if (!waitingForAuthResponse) {
			client.write('AUTH TLS\r\n')
			waitingForAuthResponse = true
		}

		if (waitingForAuthResponse && parseResponseCode(data.toString()) === '234') {
			// AUTH response
			setupTLSSocket()
		}

		if (data.toString().trim() === '200 Structure set to F.') {
			// done all set up
			performCommand(client)
		}

		// after passive mode has begun
		if (data.toString().startsWith('227 Entering Passive Mode')) {
			const numbers = data.toString().substring(data.toString().indexOf('(') + 1, data.toString().indexOf(')'))
			const numbersArr = numbers.split(',')
			const ip = numbersArr.slice(0, 4).join('.')
			const port = (Number(numbersArr[4]) << 8) + Number(numbersArr[5])

			// stop reading data
			// client.off('data', onData)
			if (command === LS) {
				client.write(`LIST ${path}\r\n`)
			} else if (command === RM) {
				client.write(`DELE ${path}\r\n`)
			} else if (command === CP || command === MV) {
				handleCopyControlChannel(client)
			}

			// open data channel socket
			if (command !== RM) {
				openDataChannel(ip, port)
			}
		}

		// wrap the data channel in tls and upload or download the appropriate file
		if (waitingForCommandResponse && data.toString().trim().startsWith('1')) {
			waitingForCommandResponse = false
			waitingForDataChannelComplete = true
			dataChannelClient = tls.connect({ socket: dataChannelClient, rejectUnauthorized: false }, () => {
				if (isUpload) {
					handleUpload(dataChannelClient)
				} else if (isDownload) {
					handleDownload(dataChannelClient)
				}
			})
			dataChannelClient.on('data', (data) => {
				console.log(data.toString())
			})
		}
	}

	// set up tls control channel
	const setupTLSSocket = () => {
		client = tls.connect({ socket: client, rejectUnauthorized: false }, () => {
			client.write(`USER ${username}\r\n`)
			if (password) {
				client.write(`PASS ${password}\r\n`)
			}
			client.write(`PBSZ 0\r\n`)
			client.write(`PROT P\r\n`)
			client.write(`TYPE I\r\n`)
			client.write(`MODE S\r\n`)
			client.write(`STRU F\r\n`)
		})
		client.on('data', onData)
		client.on('close', () => client.write(`QUIT\r\n`))
	}

	// examples used from https://www.tutorialspoint.com/nodejs/nodejs_net_module.htm
	let client = new net.Socket()
	client.connect(port, host)
	client.on('data', onData)
	client.on('close', () => client.write(`QUIT\r\n`))
}

module.exports = run
