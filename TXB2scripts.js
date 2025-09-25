const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const oldFiles = "originalTXB"
const oldUnpackFiles = "originalScripts"
unpackFiles(oldFiles, oldUnpackFiles)

function unpackFiles(sourceDir, targetDir) {
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir)
    }
    const files = fs.readdirSync(sourceDir)
    for (const file of files) {
        const inputFile = path.join(sourceDir, file)
        const buffer = fs.readFileSync(inputFile)
        let idx = 0
        let counter = 0
        while (true) {
            const startAddr = buffer.readUInt32LE(idx)
            const endAddr = buffer.readUInt32LE(idx + 4)
            idx += 4
            if (endAddr === 0) {
                break
            }
            const subBuffer = buffer.subarray(startAddr, endAddr)
            const outputFile = path.join(targetDir, `${file}_${counter}.txt`)
            fs.writeFileSync(outputFile, subBuffer)
            execSync(`lzss-tool -d -a sFLZ0,o2,c2 -n 0x00 -R 0x01 ${outputFile} ${outputFile}`)
            counter++
            console.log(`Unpacked ${outputFile} from ${inputFile}`)
        }
    }
}


