#!/usr/bin/env tsx
/**
 * Test script for DOCX and XLSX parsers
 * 
 * Usage:
 *   tsx scripts/test-parsers.ts <file-path>
 * 
 * Example:
 *   tsx scripts/test-parsers.ts test.docx
 *   tsx scripts/test-parsers.ts test.xlsx
 */

import { readFileSync } from 'fs'
import { parseDocx, parseXlsx, ParseError } from '../lib/parsers'

async function testParser(filePath: string) {
  console.log(`\n🧪 Testing parser for: ${filePath}\n`)
  
  try {
    // Read file
    const fileBuffer = readFileSync(filePath)
    const buffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    )
    
    const fileExtension = filePath.split('.').pop()?.toLowerCase()
    
    if (!fileExtension || (fileExtension !== 'docx' && fileExtension !== 'xlsx')) {
      console.error('❌ Unsupported file type. Only .docx and .xlsx files are supported.')
      process.exit(1)
    }
    
    console.log(`📄 File size: ${(buffer.byteLength / 1024).toFixed(2)} KB`)
    console.log(`📄 File type: ${fileExtension.toUpperCase()}\n`)
    
    // Parse file
    const startTime = Date.now()
    let result
    
    if (fileExtension === 'docx') {
      result = await parseDocx(buffer, {
        includeMetadata: true,
        normalizeWhitespace: false
      })
    } else {
      result = await parseXlsx(buffer, {
        includeMetadata: true,
        normalizeWhitespace: false
      })
    }
    
    const parseTime = Date.now() - startTime
    
    // Display results
    console.log('\n✅ Parsing completed successfully!\n')
    console.log('📊 Results:')
    console.log(`   Parse time: ${parseTime}ms`)
    console.log(`   Text length: ${result.text.length} characters`)
    console.log(`   Text preview (first 200 chars):`)
    console.log(`   ${result.text.substring(0, 200).replace(/\n/g, '\\n')}...\n`)
    
    if (result.metadata) {
      console.log('📋 Metadata:')
      console.log(`   Parser version: ${result.metadata.parserVersion}`)
      console.log(`   Parsed at: ${result.metadata.parsedAt}`)
    }
    
    if (result.tables && result.tables.length > 0) {
      console.log(`\n📊 Tables found: ${result.tables.length}`)
      result.tables.forEach((table, idx) => {
        console.log(`\n   Table ${idx + 1}: "${table.title}"`)
        console.log(`   Headers: ${table.headers.length}`)
        console.log(`   Rows: ${table.rows.length}`)
        if (table.headers.length > 0) {
          console.log(`   Headers: ${table.headers.slice(0, 5).join(', ')}${table.headers.length > 5 ? '...' : ''}`)
        }
      })
    } else {
      console.log('\n📊 No tables found')
    }
    
    if ('images' in result && result.images && result.images.length > 0) {
      console.log(`\n🖼️  Images found: ${result.images.length}`)
      result.images.forEach((img, idx) => {
        console.log(`\n   Image ${idx + 1}:`)
        console.log(`   Filename: ${img.filename}`)
        console.log(`   Type: ${img.type}`)
        console.log(`   Position: ${img.position}`)
        if (img.placeholder) {
          console.log(`   Placeholder: ${img.placeholder}`)
        }
        if (img.cellRef) {
          console.log(`   Cell: ${img.cellRef} (Sheet: ${img.sheetName})`)
        }
        if (img.contextBefore) {
          console.log(`   Context before: ...${img.contextBefore.substring(Math.max(0, img.contextBefore.length - 30))}`)
        }
        if (img.contextAfter) {
          console.log(`   Context after: ${img.contextAfter.substring(0, 30)}...`)
        }
      })
    } else {
      console.log('\n🖼️  No images found')
    }
    
    // Check for common issues
    console.log('\n🔍 Quality checks:')
    const issues: string[] = []
    const warnings: string[] = []
    
    if (result.text.length === 0) {
      issues.push('Text is empty')
    } else if (result.text.length < 50) {
      warnings.push('Text is very short (< 50 chars)')
    }
    
    if (result.text.includes('[IMG_')) {
      warnings.push('Found image placeholders in text (may need replacement)')
    }
    
    if (result.text.includes('data:image/')) {
      warnings.push('Found data URLs in text (should be replaced with S3 URLs)')
    }
    
    if (issues.length > 0) {
      console.log('   ❌ Issues:')
      issues.forEach(issue => console.log(`      - ${issue}`))
    }
    
    if (warnings.length > 0) {
      console.log('   ⚠️  Warnings:')
      warnings.forEach(warning => console.log(`      - ${warning}`))
    }
    
    if (issues.length === 0 && warnings.length === 0) {
      console.log('   ✅ No issues found')
    }
    
    console.log('\n✨ Test completed successfully!\n')
    
  } catch (error) {
    console.error('\n❌ Error during parsing:')
    if (error instanceof ParseError) {
      console.error(`   ${error.name}: ${error.message}`)
    } else if (error instanceof Error) {
      console.error(`   ${error.name}: ${error.message}`)
      console.error(`   Stack: ${error.stack}`)
    } else {
      console.error('   Unknown error:', error)
    }
    process.exit(1)
  }
}

// Main
const filePath = process.argv[2]

if (!filePath) {
  console.error('Usage: tsx scripts/test-parsers.ts <file-path>')
  console.error('Example: tsx scripts/test-parsers.ts test.docx')
  process.exit(1)
}

testParser(filePath).catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

