const fs = require('fs')
const path = require('path')
const iconv = require('iconv-lite')

const tableFile = "table.json"
const oldUnpackFiles = "originalScripts"
createTable(tableFile, oldUnpackFiles)

function createTable(tableFile, refDir) {
    const table = {}
    const files = fs.readdirSync(refDir)
    
    for (const file of files) {
        const filePath = path.join(refDir, file)
        const buffer = fs.readFileSync(filePath)
        
        // Parse file structure
        const sentences = parseTextFile(buffer, file)
        table[file] = sentences
    }
    
    fs.writeFileSync(tableFile, JSON.stringify(table, null, 2))
    console.log(`01. Successfully created ${tableFile} file`)
}

function parseTextFile(buffer, fileName) {
    const sentences = []
    
    // Read sentence count (first 2 bytes, little endian)
    const sentenceCount = buffer.readUInt16LE(0)
    
    // Read start address for each sentence
    const addresses = []
    for (let i = 0; i < sentenceCount; i++) {
        const addr = buffer.readUInt16LE(2 + i * 2)
        addresses.push(addr)
    }
    
    // Extract content for each sentence
    for (let i = 0; i < addresses.length; i++) {
        const startAddr = addresses[i]
        const nextAddr = i < addresses.length - 1 ? addresses[i + 1] : buffer.length
        
        // Extract sentence hex data
        const jpBuffer = buffer.subarray(startAddr, nextAddr)

        // Parse sentence with custom character handling
        let jp = parseJpText(jpBuffer)
        while(jp.endsWith('\u0000')) {
            jp = jp.slice(0, -1)
        }
        
        // Create table entry
        sentences.push({
            jp,
            en: ''
        })
    }
    
    return sentences
}

function parseJpText(buffer) {
    let result = ''
    let i = 0
    
    while (i < buffer.length) {
        const byte1 = buffer[i]
        
        // Check for custom character range [\xEB-\xEF][\x40-\x7E\x80-\xFC]
        if (byte1 >= 0xEB && byte1 <= 0xEF && i + 1 < buffer.length) {
            const byte2 = buffer[i + 1]
            if ((byte2 >= 0x40 && byte2 <= 0x7E) || (byte2 >= 0x80 && byte2 <= 0xFC)) {
                // Custom character - use placeholder
                result += `[${byte1.toString(16).toUpperCase().padStart(2, '0')}${byte2.toString(16).toUpperCase().padStart(2, '0')}]`
                i += 2
                continue
            }
        }
        
        // Check for Shift-JIS double-byte character
        if ((byte1 >= 0x81 && byte1 <= 0x9F) || (byte1 >= 0xE0 && byte1 <= 0xFC)) {
            if (i + 1 < buffer.length) {
                const byte2 = buffer[i + 1]
                if ((byte2 >= 0x40 && byte2 <= 0x7E) || (byte2 >= 0x80 && byte2 <= 0xFC)) {
                    // Valid Shift-JIS character
                    const charBytes = Buffer.from([byte1, byte2])
                    result += iconv.decode(charBytes, 'shift_jis')
                    i += 2
                    continue
                }
            }
        }
        
        // Single byte character (ASCII or control character)
        if (byte1 < 0x80) {
            result += String.fromCharCode(byte1)
        } else {
            // Fallback for other characters
            result += `[0x${byte1.toString(16).toUpperCase().padStart(2, '0')}]`
        }
        
        i++
    }
    
    return result
}
