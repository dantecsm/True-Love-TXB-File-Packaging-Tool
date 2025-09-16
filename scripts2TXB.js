const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const sourceDir = 'scripts'
const targetDir = 'TXB'
packFiles(sourceDir, targetDir)

function packFiles(sourceDir, targetDir) {
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir)
    }
    
    // Get all unpacked files and group them by original filename
    const files = fs.readdirSync(sourceDir)
    const fileGroups = {}
    
    // Group files by original filename
    for (const file of files) {
        const match = file.match(/^(.+)_(\d+)\.txt$/)
        if (match) {
            const [, baseName, index] = match
            if (!fileGroups[baseName]) {
                fileGroups[baseName] = []
            }
            fileGroups[baseName].push({
                file: file,
                index: parseInt(index)
            })
        }
    }
    
    // Process each file group
    for (const [baseName, fileList] of Object.entries(fileGroups)) {
        // Sort by index
        fileList.sort((a, b) => a.index - b.index)
        
        console.log(`\n🔄 Packing: ${baseName} (${fileList.length} files)`)
        
        // Create packed file
        const outputFile = path.join(targetDir, baseName)
        packSingleFile(sourceDir, outputFile, fileList)
        
        console.log(`✅ Packed: ${outputFile}`)
    }
}

function packSingleFile(inputDir, outputFile, fileList) {
    const buffers = []
    const addresses = []
    let currentOffset = 0
    
    // Calculate address table size (4 bytes per address, start addresses + end address of last file)
    const addressTableSize = (fileList.length + 1) * 4
    
    // First subfile always starts at 0x200
    const firstSubfileOffset = 0x200
    currentOffset = firstSubfileOffset
    
    // Process each file
    for (const fileInfo of fileList) {
        const inputFile = path.join(inputDir, fileInfo.file)
        
        // Read original file
        let fileBuffer = fs.readFileSync(inputFile)
        
        // Create temporary compressed file
        const tempCompressedFile = inputFile + '.compressed'
        
        try {
            // Use lzss-tool to compress file
            execSync(`lzss-tool -e -a sFLZ0,o2,c2 -n 0x00 -R 0x01 "${inputFile}" "${tempCompressedFile}"`)
            
            // Read compressed file
            fileBuffer = fs.readFileSync(tempCompressedFile)
            
            // Delete temporary file
            fs.unlinkSync(tempCompressedFile)
            
            console.log(`  ✓ Compressed: ${fileInfo.file} (${fileBuffer.length} bytes)`)
        } catch (error) {
            console.warn(`  ⚠️  Compression failed, using original file: ${fileInfo.file}`)
            // If compression fails, use original file
        }
        
        // Record start address
        const startAddr = currentOffset
        
        addresses.push(startAddr)
        buffers.push(fileBuffer)
        
        currentOffset += fileBuffer.length
    }
    
    // Add end address of last file as terminator
    addresses.push(currentOffset)
    
    // Calculate total size including padding between address table and subfiles
    const dataSize = buffers.reduce((sum, buf) => sum + buf.length, 0)
    const totalSize = firstSubfileOffset + dataSize
    const finalBuffer = Buffer.alloc(totalSize)
    
    // Fill the entire buffer with 0x00
    finalBuffer.fill(0x00)
    
    // Write address table at the beginning (only start addresses)
    let writeOffset = 0
    for (const addr of addresses) {
        finalBuffer.writeUInt32LE(addr, writeOffset)
        writeOffset += 4
    }
    
    // Write file data starting from 0x200
    writeOffset = firstSubfileOffset
    for (const buffer of buffers) {
        buffer.copy(finalBuffer, writeOffset)
        writeOffset += buffer.length
    }
    
    // Write final file
    fs.writeFileSync(outputFile, finalBuffer)
    
    console.log(`    File size: ${totalSize} bytes`)
    console.log(`    Address table: ${addressTableSize} bytes`)
    console.log(`    Padding area: ${firstSubfileOffset - addressTableSize} bytes`)
    console.log(`    Data area: ${dataSize} bytes`)
}
