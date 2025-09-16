# True Love PC98 TXB File Packaging Tool

This project creates `TXB` files for *True Love(PC98)* from `table.json`.

## Requirements

- [Node.js](https://nodejs.org/) installed
- Recommended to run in a Windows environment

## Installation
```bash
npm install
```

## Usage
```bash
node table2Scripts.js && node scripts2TXB.js
```

## NOTE
The "archive" directory contains the Japanese and English scripts from the Win95 version of this game, as well as the text I extracted from them.
I used `archive/all.txt` as references to auto-fill about 85% of the "en" fields in table.json.
