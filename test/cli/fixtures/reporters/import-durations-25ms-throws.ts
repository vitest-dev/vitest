await new Promise(resolve => setTimeout(resolve, 25))

throw new Error('test')

export {}
