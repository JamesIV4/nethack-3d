#!/usr/bin/env node

/**
 * Quick-start script for EvilHack with predefined character
 * 
 * Usage:
 *   node scripts/dev/quick-start-evilhack.mjs [role] [race] [gender] [align]
 * 
 * Examples:
 *   node scripts/dev/quick-start-evilhack.mjs
 *   node scripts/dev/quick-start-evilhack.mjs Wizard
 *   node scripts/dev/quick-start-evilhack.mjs Barbarian Dwarf male chaotic
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

// Parse command line arguments
const args = process.argv.slice(2);
const role = args[0] || 'random';
const race = args[1] || 'random';
const gender = args[2] || 'random';
const align = args[3] || 'random';

console.log('🎮 NetHack-3D EvilHack Quick Start');
console.log('════════════════════════════════════');
console.log(`Role:     ${role}`);
console.log(`Race:     ${race}`);
console.log(`Gender:   ${gender}`);
console.log(`Alignment: ${align}`);
console.log('');

// Create a simple HTML file that will auto-start the game
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NetHack-3D EvilHack Quick Start</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background: #000;
            color: #0f0;
        }
        #game {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .loading {
            text-align: center;
        }
        .loading h2 {
            margin: 0 0 20px 0;
        }
        .spinner {
            border: 4px solid #0f0;
            border-top: 4px solid transparent;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div id="game">
        <div class="loading">
            <h2>Loading EvilHack...</h2>
            <div class="spinner"></div>
            <p id="status">Initializing runtime...</p>
        </div>
    </div>
    <script>
        // Store character preferences
        window.__NH3D_STARTUP_CONFIG__ = {
            runtimeVersion: 'evilhack',
            characterCreation: {
                mode: 'new',
                role: '${role}',
                race: '${race}',
                gender: '${gender}',
                align: '${align}'
            }
        };
        
        // Log configuration
        console.log('🎮 EvilHack Quick Start Configuration:', window.__NH3D_STARTUP_CONFIG__);
        
        // Update status
        function updateStatus(msg) {
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.textContent = msg;
            }
            console.log('[Status]', msg);
        }
        
        // Load the app
        const appScript = document.createElement('script');
        appScript.type = 'module';
        appScript.src = '/src/main.tsx';
        appScript.onload = () => updateStatus('App loaded successfully!');
        appScript.onerror = (err) => {
            updateStatus('Error loading app: ' + (err?.message || 'Unknown error'));
            console.error('[Error]', err);
        };
        document.body.appendChild(appScript);
        
        updateStatus('Loading NetHack-3D...');
    </script>
</body>
</html>
`;

// Write temporary HTML to a temp file
const tempDir = path.join(projectRoot, '.dev-temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}
const htmlPath = path.join(tempDir, 'quickstart-evilhack.html');
fs.writeFileSync(htmlPath, htmlContent);

console.log('📝 Created temporary HTML file');
console.log('');

// Serve the file on a local port
const PORT = 5174;

const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle the quick start page
    if (req.url === '/' || req.url === '/quickstart') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlContent);
        return;
    }
    
    // Handle requests to the project root
    let filePath = path.join(projectRoot, req.url);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(projectRoot)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    // Handle directory requests
    if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            // Redirect to index.html if it exists
            const indexPath = path.join(filePath, 'index.html');
            if (fs.existsSync(indexPath)) {
                filePath = indexPath;
            } else {
                res.writeHead(404);
                res.end('Not Found');
                return;
            }
        }
    }
    
    // Serve the file
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.jsx': 'application/javascript',
            '.ts': 'text/typescript',
            '.tsx': 'text/typescript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.wasm': 'application/wasm',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, 'localhost', () => {
    console.log('✅ Server running at http://localhost:' + PORT);
    console.log('');
    console.log('📖 Instructions:');
    console.log('1. Open http://localhost:' + PORT + ' in your browser');
    console.log('2. The game should auto-start with your character settings');
    console.log('3. Press Ctrl+C to stop the server');
    console.log('');
    console.log('💡 Tips:');
    console.log('- Character preferences are applied automatically');
    console.log('- Check browser console for debug logs');
    console.log('- Check this terminal for server logs');
    console.log('');
});

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('');
    console.log('🛑 Shutting down...');
    server.close(() => {
        console.log('Server stopped.');
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});
