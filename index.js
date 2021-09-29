const run = require('./ftp')

const CP = 'cp'
const MV = 'mv'

const args = process.argv.slice(2)

// get command line command
let command = args[0]
const arg1 = args[1]
let arg2 = ''

if (command === CP || command === MV) {
	arg2 = args[2]
}

// arg1 is the remote file, arg2 must be a local file
const arg1IsRemote = arg1.includes('ftps://')

// error checking with two arguments
if (arg2.length > 0) {
	if (arg1IsRemote && arg2.includes('ftps://')) {
		console.log('Error: both arguments are URLs')
		return
	} else if (!arg1IsRemote && !arg1.includes('ftps://')) {
		console.log('Error: both arguments are local file paths')
		return
	}
}

run(command, arg1, arg2, arg1IsRemote, () => {
	if (command === MV && arg1IsRemote) {
		// delete file on remote
		run('rm', arg1, arg2, arg1IsRemote)
	}
})
