const fs = require('fs');
const path = require('path');

/**
 * Copy data folder to public/data during build
 * This ensures JSON files are accessible as static assets in production
 */

const sourceDir = path.join(process.cwd(), 'data');
const targetDir = path.join(process.cwd(), 'public', 'data');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  if (fs.existsSync(sourceDir)) {
    console.log('📦 Copying data folder to public/data...');
    copyRecursiveSync(sourceDir, targetDir);
    console.log('✅ Data folder copied successfully');
  } else {
    console.warn('⚠️  data folder not found, skipping copy');
  }
} catch (error) {
  console.error('❌ Error copying data folder:', error);
  process.exit(1);
}
