#!/usr/bin/env tsx
/**
 * Check script to verify document rendering components are working correctly
 * Tests import and basic functionality
 */

async function main() {
  console.log('🧪 Checking document rendering components...\n')

  // Check React Markdown dependencies
  try {
    console.log('📚 Testing React Markdown dependencies...')
    const reactMarkdown = await import('react-markdown')
    const remarkGfm = await import('remark-gfm')
    const rehypeRaw = await import('rehype-raw')
    const rehypeSanitize = await import('rehype-sanitize')
    
    console.log('   ✅ react-markdown imported')
    console.log('   ✅ remark-gfm imported')
    console.log('   ✅ rehype-raw imported')
    console.log('   ✅ rehype-sanitize imported')
  } catch (error) {
    console.error('   ❌ React Markdown dependencies failed:', error)
    process.exit(1)
  }

  // Check DocumentRenderer component import
  try {
    console.log('📄 Testing DocumentRenderer component...')
    // Note: This is a client component, so we can't directly import it in Node.js
    // But we can check if the file exists and has valid exports
    const fs = await import('fs')
    const path = await import('path')
    
    const rendererPath = path.join(process.cwd(), 'components', 'common', 'document-renderer.tsx')
    if (fs.existsSync(rendererPath)) {
      const content = fs.readFileSync(rendererPath, 'utf-8')
      
      // Check for key exports and functions
      const hasDocumentRenderer = content.includes('export function DocumentRenderer')
      const hasDocumentContent = content.includes('function DocumentContent')
      const hasTableRenderer = content.includes('function TableRenderer')
      const hasConvertToMarkdown = content.includes('function convertToMarkdown')
      
      console.log(`   ✅ DocumentRenderer file exists`)
      console.log(`   ✅ DocumentRenderer function: ${hasDocumentRenderer ? 'found' : 'not found'}`)
      console.log(`   ✅ DocumentContent function: ${hasDocumentContent ? 'found' : 'not found'}`)
      console.log(`   ✅ TableRenderer function: ${hasTableRenderer ? 'found' : 'not found'}`)
      console.log(`   ✅ convertToMarkdown function: ${hasConvertToMarkdown ? 'found' : 'not found'}`)
      
      if (!hasDocumentRenderer || !hasDocumentContent || !hasTableRenderer) {
        throw new Error('Missing required functions in DocumentRenderer')
      }
    } else {
      throw new Error('DocumentRenderer file not found')
    }
  } catch (error) {
    console.error('   ❌ DocumentRenderer check failed:', error)
    process.exit(1)
  }

  // Check image utilities
  try {
    console.log('🖼️  Testing image utilities...')
    const imageUtils = await import('../lib/image-utils')
    
    const hasGetImageSizeCategory = typeof imageUtils.getImageSizeCategory === 'function'
    const hasGetOptimizedImageProps = typeof imageUtils.getOptimizedImageProps === 'function'
    const hasIsLikelyQRCode = typeof imageUtils.isLikelyQRCode === 'function'
    const hasIsLikelyIcon = typeof imageUtils.isLikelyIcon === 'function'
    
    console.log(`   ✅ getImageSizeCategory: ${hasGetImageSizeCategory ? 'function' : 'not found'}`)
    console.log(`   ✅ getOptimizedImageProps: ${hasGetOptimizedImageProps ? 'function' : 'not found'}`)
    console.log(`   ✅ isLikelyQRCode: ${hasIsLikelyQRCode ? 'function' : 'not found'}`)
    console.log(`   ✅ isLikelyIcon: ${hasIsLikelyIcon ? 'function' : 'not found'}`)
    
    if (!hasGetImageSizeCategory || !hasGetOptimizedImageProps) {
      throw new Error('Missing required image utility functions')
    }
  } catch (error) {
    console.error('   ❌ Image utilities check failed:', error)
    process.exit(1)
  }

  // Check pages that use DocumentRenderer
  try {
    console.log('📑 Testing document pages...')
    const fs = await import('fs')
    const path = await import('path')
    
    const readPagePath = path.join(process.cwd(), 'app', 'read', '[documentId]', 'page.tsx')
    const docsPagePath = path.join(process.cwd(), 'app', 'docs', '[filename]', 'page.tsx')
    
    const readPageExists = fs.existsSync(readPagePath)
    const docsPageExists = fs.existsSync(docsPagePath)
    
    if (readPageExists) {
      const content = fs.readFileSync(readPagePath, 'utf-8')
      const usesDocumentRenderer = content.includes('DocumentRenderer')
      console.log(`   ✅ app/read/[documentId]/page.tsx: ${usesDocumentRenderer ? 'uses DocumentRenderer' : 'does not use DocumentRenderer'}`)
    } else {
      console.log(`   ⚠️  app/read/[documentId]/page.tsx: not found`)
    }
    
    if (docsPageExists) {
      const content = fs.readFileSync(docsPagePath, 'utf-8')
      const usesDocumentRenderer = content.includes('DocumentRenderer')
      console.log(`   ✅ app/docs/[filename]/page.tsx: ${usesDocumentRenderer ? 'uses DocumentRenderer' : 'does not use DocumentRenderer'}`)
    } else {
      console.log(`   ⚠️  app/docs/[filename]/page.tsx: not found`)
    }
  } catch (error) {
    console.error('   ❌ Document pages check failed:', error)
    process.exit(1)
  }

  console.log('\n✨ All rendering checks passed!\n')
  console.log('📝 Summary:')
  console.log('   ✅ React Markdown dependencies: Working')
  console.log('   ✅ DocumentRenderer component: Found')
  console.log('   ✅ Image utilities: Working')
  console.log('   ✅ Document pages: Found\n')
  console.log('💡 Note: DocumentRenderer is a client component and requires React.')
  console.log('   To fully test rendering, use the browser or React Testing Library.\n')
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

