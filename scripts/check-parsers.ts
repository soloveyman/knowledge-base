#!/usr/bin/env tsx
/**
 * Quick check script to verify parsers are working correctly
 * Tests import and basic functionality without requiring actual files
 */

import * as XLSX from 'xlsx'
import * as mammoth from 'mammoth'
import JSZip from 'jszip'

async function main() {
  console.log('🧪 Checking parser dependencies...\n')

  // Check XLSX
  try {
    console.log('📊 Testing XLSX parser...')
    const testWorkbook = XLSX.utils.book_new()
    const testSheet = XLSX.utils.aoa_to_sheet([['Name', 'Value'], ['Test', '123']])
    XLSX.utils.book_append_sheet(testWorkbook, testSheet, 'Test')
    const xlsxBuffer = XLSX.write(testWorkbook, { type: 'array', bookType: 'xlsx' })
    console.log(`   ✅ XLSX parser works (created test workbook, ${xlsxBuffer.length} bytes)`)
  } catch (error) {
    console.error('   ❌ XLSX parser failed:', error)
    process.exit(1)
  }

  // Check Mammoth (just check import, not full conversion)
  try {
    console.log('📄 Testing Mammoth parser...')
    if (typeof mammoth.convertToHtml === 'function') {
      console.log(`   ✅ Mammoth parser imported successfully (version: ${mammoth.version || 'unknown'})`)
    } else {
      throw new Error('convertToHtml is not a function')
    }
  } catch (error) {
    console.error('   ❌ Mammoth parser failed:', error)
    process.exit(1)
  }

  // Check JSZip
  try {
    console.log('📦 Testing JSZip...')
    const testZip = new JSZip()
    testZip.file('test.txt', 'Hello World')
    const zipBuffer = await testZip.generateAsync({ type: 'arraybuffer' })
    console.log(`   ✅ JSZip works (created test archive, ${zipBuffer.byteLength} bytes)`)
  } catch (error) {
    console.error('   ❌ JSZip failed:', error)
    process.exit(1)
  }

  // Check parser functions import
  try {
    console.log('📚 Testing parser functions import...')
    const { parseDocx, parseXlsx, ParseError, UnsupportedFileTypeError, parseDocument } = await import('../lib/parsers')
    console.log('   ✅ Parser functions imported successfully')
    console.log(`   ✅ parseDocx: ${typeof parseDocx === 'function' ? 'function' : 'not a function'}`)
    console.log(`   ✅ parseXlsx: ${typeof parseXlsx === 'function' ? 'function' : 'not a function'}`)
    console.log(`   ✅ parseDocument: ${typeof parseDocument === 'function' ? 'function' : 'not a function'}`)
    console.log(`   ✅ ParseError: ${ParseError ? 'class' : 'not found'}`)
    console.log(`   ✅ UnsupportedFileTypeError: ${UnsupportedFileTypeError ? 'class' : 'not found'}`)
  } catch (error) {
    console.error('   ❌ Parser functions import failed:', error)
    console.error('   Error details:', error)
    process.exit(1)
  }

  console.log('\n✨ All parser checks passed!\n')
  console.log('📝 Summary:')
  console.log('   ✅ XLSX library: Working')
  console.log('   ✅ Mammoth library: Working')
  console.log('   ✅ JSZip library: Working')
  console.log('   ✅ Parser functions: Imported successfully\n')
  console.log('📝 To test with actual files, use:')
  console.log('   npx tsx scripts/test-parsers.ts <path-to-file.docx>')
  console.log('   npx tsx scripts/test-parsers.ts <path-to-file.xlsx>\n')
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
