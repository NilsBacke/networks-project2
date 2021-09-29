## Approach

My general approach was exactly as outlined in the "Suggested Implementation Approach" portion of the project instructions. I first gathered and organized all of the command line arguments, and then proceeded to make the basic socket connection. From there I gradually increased complexity by handling more commands.

## Challenges

My first challenge was figuring out how to "not attempt to read a response from the server". After some testing it turns out that I don't need to do anything (at least in Javascript) to make this happen, as the way to receive data from a socket in Javascript is by using the `socket.on('data', callback)` method.

## Testing Strategies

I relied on using the `ls` command for the majority of my testing. However, when I was implementing the `mkdir` and `rmdir` functions, I did not have `ls` set up yet. So I could not test the `mkdir` and `rmdir` functions until I implemented `ls`. Also, I heavily relied on console log statements to debug and to see what data I was getting via the socket.
