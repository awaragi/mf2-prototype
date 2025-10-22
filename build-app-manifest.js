#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MANIFEST_FILE = './app-manifest.js';

// Fast hash function using MD5 (fastest built-in option)
function calculateHash(filePath) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(fileBuffer).digest('hex').substring(0, 8);
    } catch (error) {
        console.error(`Error hashing file ${filePath}:`, error.message);
        return 'e3b0c44'; // Default hash for missing/error files
    }
}

// Parse app-manifest.js to extract file paths
function parseManifest() {
    try {
        const manifestContent = fs.readFileSync(MANIFEST_FILE, 'utf8');
        const cacheMatch = manifestContent.match(/export const APP_CACHE = ({[\s\S]*?});?/);

        if (!cacheMatch) {
            throw new Error('Could not find APP_CACHE object in manifest file');
        }

        // Extract file paths from the object
        const cacheObject = cacheMatch[1];
        const pathMatches = cacheObject.match(/"([^"]+)":\s*"[^"]+"/g);

        if (!pathMatches) {
            throw new Error('Could not parse file paths from APP_CACHE');
        }

        return pathMatches.map(match => {
            const pathMatch = match.match(/"([^"]+)":/);
            return pathMatch ? pathMatch[1] : null;
        }).filter(Boolean);
    } catch (error) {
        console.error('Error parsing manifest:', error.message);
        return [];
    }
}

// Update hash for a specific file in the manifest
function updateFileHash(filePath, newHash) {
    try {
        let manifestContent = fs.readFileSync(MANIFEST_FILE, 'utf8');

        // Create regex to match the specific file path and its hash
        const regex = new RegExp(`("${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}":\\s*)"[^"]+"`);

        if (regex.test(manifestContent)) {
            manifestContent = manifestContent.replace(regex, `$1"${newHash}"`);
            fs.writeFileSync(MANIFEST_FILE, manifestContent, 'utf8');
            console.log(`✓ Updated hash for ${filePath}: ${newHash}`);
        } else {
            console.warn(`⚠ Could not find entry for ${filePath} in manifest`);
        }
    } catch (error) {
        console.error(`Error updating hash for ${filePath}:`, error.message);
    }
}

// Convert relative paths to absolute paths for watching
function resolveFilePaths(filePaths) {
    return filePaths.map(filePath => {
        // Remove leading slash and resolve relative to current directory
        const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        return {
            original: filePath,
            resolved: path.resolve(relativePath)
        };
    });
}

// Rebuild entire manifest file with fresh hashes
function rebuildManifest() {
    console.log('🔄 Rebuilding app-manifest.js with fresh hashes...\n');

    // Parse manifest and get file paths
    const filePaths = parseManifest();

    if (filePaths.length === 0) {
        console.error('❌ No files found in manifest. Exiting.');
        process.exit(1);
    }

    console.log(`📁 Found ${filePaths.length} files to process:`);
    filePaths.forEach(fp => console.log(`   - ${fp}`));
    console.log();

    // Calculate fresh hashes for all files
    const updatedCache = {};
    let processedCount = 0;

    filePaths.forEach(filePath => {
        // Remove leading slash and resolve relative to current directory
        const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        const resolvedPath = path.resolve(relativePath);

        const newHash = calculateHash(resolvedPath);
        updatedCache[filePath] = newHash;

        console.log(`✓ ${filePath}: ${newHash}`);
        processedCount++;
    });

    // Generate new manifest content
    const manifestContent = `export const APP_CACHE = {\n${
        Object.entries(updatedCache)
            .map(([filePath, hash]) => `  "${filePath}": "${hash}"`)
            .join(',\n')
    }\n}`;

    // Write the new manifest file
    try {
        fs.writeFileSync(MANIFEST_FILE, manifestContent, 'utf8');
        console.log(`\n✅ Rebuilt manifest with ${processedCount} files`);
        console.log(`📄 Updated ${MANIFEST_FILE}`);
    } catch (error) {
        console.error('❌ Error writing manifest file:', error.message);
        process.exit(1);
    }
}

// Main monitoring function
function startMonitoring() {
    console.log('🚀 Starting file monitor for app-manifest.js...\n');

    // Parse manifest and get file paths
    const filePaths = parseManifest();

    if (filePaths.length === 0) {
        console.error('❌ No files found to monitor. Exiting.');
        process.exit(1);
    }

    console.log(`📁 Found ${filePaths.length} files to monitor:`);
    filePaths.forEach(fp => console.log(`   - ${fp}`));
    console.log();

    // Resolve file paths
    const resolvedPaths = resolveFilePaths(filePaths);
    const watchPaths = resolvedPaths.map(p => p.resolved);

    // Filter existing files
    const existingFiles = resolvedPaths.filter(({ resolved }) => {
        try {
            return fs.existsSync(resolved) && fs.statSync(resolved).isFile();
        } catch {
            return false;
        }
    });

    if (existingFiles.length === 0) {
        console.error('❌ No existing files found to monitor. Check file paths.');
        process.exit(1);
    }

    console.log(`👀 Monitoring ${existingFiles.length} existing files for changes...\n`);

    // Set up file watchers using Node.js built-in fs.watch()
    const watchers = [];
    const fileStates = new Map();

    // Initialize file states
    existingFiles.forEach(({ resolved, original }) => {
        try {
            const stats = fs.statSync(resolved);
            fileStates.set(resolved, stats.mtime.getTime());
        } catch (error) {
            console.warn(`⚠ Could not get initial state for ${original}:`, error.message);
        }
    });

    existingFiles.forEach(({ resolved, original }) => {
        try {
            const watcher = fs.watch(resolved, (eventType, filename) => {
                if (eventType === 'change') {
                    try {
                        const stats = fs.statSync(resolved);
                        const currentMtime = stats.mtime.getTime();
                        const lastMtime = fileStates.get(resolved) || 0;

                        // Only process if file actually changed (avoid duplicate events)
                        if (currentMtime > lastMtime) {
                            fileStates.set(resolved, currentMtime);
                            console.log(`📝 File changed: ${original}`);
                            const newHash = calculateHash(resolved);
                            updateFileHash(original, newHash);
                        }
                    } catch (error) {
                        console.warn(`⚠ Error processing change for ${original}:`, error.message);
                    }
                }
            });

            watchers.push(watcher);

            watcher.on('error', (error) => {
                console.error(`❌ Watcher error for ${original}:`, error.message);
            });

        } catch (error) {
            console.error(`❌ Failed to watch ${original}:`, error.message);
        }
    });

    // Handle process termination
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down file monitor...');
        watchers.forEach(watcher => {
            try {
                watcher.close();
            } catch (error) {
                // Ignore errors when closing watchers
            }
        });
        process.exit(0);
    });

    console.log('✅ File monitor is running. Press Ctrl+C to stop.\n');
}

// Initialize and start monitoring or rebuild
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--rebuild') || args.includes('-r')) {
        rebuildManifest();
    } else if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage:');
        console.log('  node build-app-manifest.js          # Start file monitoring');
        console.log('  node build-app-manifest.js --rebuild # Rebuild entire manifest');
        console.log('  node build-app-manifest.js -r        # Rebuild entire manifest (short)');
        console.log('  node build-app-manifest.js --help    # Show this help');
    } else {
        startMonitoring();
    }
}