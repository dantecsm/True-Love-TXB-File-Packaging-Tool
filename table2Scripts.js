const fs = require('fs')
const path = require('path')
const iconv = require('iconv-lite')

const tableFile = 'table.json'
const scriptsDir = 'scripts'
genScripts(tableFile, scriptsDir)

function genScripts(tableFile, destDir) {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir)
    }
    const table = JSON.parse(fs.readFileSync(tableFile))
    for (const file in table) {
        const lines = table[file]
        const buffers = []
        const addrs = []
        let addr = 2 + lines.length * 2
        for (const line of lines) {
            const { jp, en } = line
            const text = en !== '' ? en : jp
            const buffer = text2Buffer(text)
            buffers.push(buffer)
            addrs.push(addr)
            addr += buffer.length
        }

        const contentBuffer = Buffer.concat(buffers)
        const countBuffer = Buffer.alloc(2)
        countBuffer.writeUInt16LE(lines.length, 0)
        const addrsBuffer = Buffer.alloc(lines.length * 2)
        for (let i = 0; i < addrs.length; i++) {
            addrsBuffer.writeUInt16LE(addrs[i], i * 2)
        }
        const fileBuffer = Buffer.concat([countBuffer, addrsBuffer, contentBuffer])

        const destFile = path.join(destDir, file)
        fs.writeFileSync(destFile, fileBuffer)
    }
}

function text2Buffer(text) {
    // Recognize [EB9F], [EBA6], [EBA7], [EBA8] in sjis, and convert them directly to two bytes EB XX
    const specialChars = {
        '[EB9F]': [0xEB, 0x9F],
        '[EBA6]': [0xEB, 0xA6], 
        '[EBA7]': [0xEB, 0xA7],
        '[EBA8]': [0xEB, 0xA8],
        '[0xA5]': [0xA5],
        '[0xD3]': [0xD3],
        '[0xBC]': [0xBC]
    }
    
    const buffers = []
    let remainingText = text
    
    // Use regex to find all special character positions
    const pattern = /\[EB(9F|A6|A7|A8)\]/g
    let match
    let lastIndex = 0
    
    while ((match = pattern.exec(remainingText)) !== null) {
        // Add text before the special character
        if (match.index > lastIndex) {
            const beforeText = remainingText.substring(lastIndex, match.index)
            if (beforeText) {
                buffers.push(iconv.encode(beforeText, 'shift_jis'))
            }
        }
        
        // Add the bytes corresponding to the special character
        const specialChar = match[0]
        const bytes = specialChars[specialChar]
        if (bytes) {
            buffers.push(Buffer.from(bytes))
        }
        
        lastIndex = match.index + match[0].length
    }
    
    // Add the text after the last special character
    if (lastIndex < remainingText.length) {
        const afterText = remainingText.substring(lastIndex)
        if (afterText) {
            buffers.push(iconv.encode(afterText, 'shift_jis'))
        }
    }
    
    // If no special character is found, encode the whole text normally
    if (buffers.length === 0) {
        buffers.push(iconv.encode(remainingText, 'shift_jis'))
    }
    
    let buffer = Buffer.concat(buffers)
    buffer = Buffer.concat([buffer, Buffer.from([0x00])])
    return buffer
}