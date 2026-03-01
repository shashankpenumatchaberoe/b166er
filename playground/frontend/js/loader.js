/**
 * loader.js — Full-screen Matrix loader on app initialization
 * Displays digital rain effect for 3 seconds on page load
 */

(function() {
  'use strict';

  // Initialize loader with digital rain effect
  window.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('matrix-loader');
    if (!loader) return;

    const app = document.getElementById('app');
    
    // Check if loader has already been shown this session
    const loaderShown = sessionStorage.getItem('matrix-loader-shown');
    
    if (loaderShown) {
      // Already handled by inline styles - loader is hidden, app is visible
      return;
    }

    // Mark loader as shown for this session
    sessionStorage.setItem('matrix-loader-shown', 'true');

    // Ensure DigitalRain class is available
    if (typeof DigitalRain === 'undefined') {
      console.error('DigitalRain class not found. Make sure digital-rain.js is loaded.');
      return;
    }

    // Create digital rain effect on the loader with full opacity
    const digitalRain = new DigitalRain(loader);
    
    // Override canvas opacity for full-screen loader (make it more visible)
    if (digitalRain.canvas) {
      digitalRain.canvas.style.opacity = '0.4';
    }

    // Remove loader after 3 seconds, then 1.5 second zoom
    setTimeout(() => {
      loader.classList.add('fade-out');
      
      // Add zoom animation to canvas
      if (digitalRain.canvas) {
        digitalRain.canvas.style.transition = 'transform 1.5s ease-out';
        digitalRain.canvas.style.transform = 'scale(3)';
      }
      
      // Zoom in the main app content
      if (app) {
        app.classList.add('loaded');
      }
      
      // Remove from DOM after fade animation completes
      setTimeout(() => {
        digitalRain.destroy();
        loader.remove();
      }, 1500); // Match CSS transition duration
    }, 3000);
  });
})();
