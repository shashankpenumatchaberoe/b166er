/**
 * matrix-rain.js — Matrix falling characters animation
 * Creates a canvas-based rain of characters for the Matrix aesthetic
 */

class MatrixRain {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.drops = [];
    
    this.init();
  }

  init() {
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.zIndex = '0';
    this.canvas.style.pointerEvents = 'none';
    
    this.container.insertBefore(this.canvas, this.container.firstChild);
    
    this.ctx = this.canvas.getContext('2d');
    
    // Set dimensions
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Set up letters (matrix characters with some numbers and symbols)
    this.letters = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'.split('');
    
    this.fontSize = 14;
    this.columns = Math.floor(this.canvas.width / this.fontSize);
    
    // Initialize drops
    this.drops = [];
    for (let i = 0; i < this.columns; i++) {
      this.drops[i] = Math.random() * this.canvas.height / this.fontSize;
    }
    
    // Start animation
    this.draw();
  }

  resize() {
    this.canvas.width = this.container.offsetWidth;
    this.canvas.height = this.container.offsetHeight;
  }

  draw() {
    // Fade effect
    this.ctx.fillStyle = 'rgba(3, 3, 3, 0.15)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw falling characters
    for (let i = 0; i < this.drops.length; i++) {
      const text = this.letters[Math.floor(Math.random() * this.letters.length)];
      
      // Color intensity based on position
      const hue = Math.sin(this.drops[i] * 0.05) * 50 + 100;
      this.ctx.fillStyle = '#00FF41';
      this.ctx.globalAlpha = 0.3 - (this.drops[i] % 10) * 0.03;
      this.ctx.font = `bold ${this.fontSize}px 'Share Tech Mono'`;
      this.ctx.fillText(text, i * this.fontSize, this.drops[i] * this.fontSize);
      this.ctx.globalAlpha = 1;
      
      // Reset drop if it reaches bottom and random chance
      this.drops[i]++;
      if (this.drops[i] * this.fontSize > this.canvas.height && Math.random() > 0.95) {
        this.drops[i] = 0;
      }
    }
    
    this.animationId = requestAnimationFrame(() => this.draw());
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    window.removeEventListener('resize', () => this.resize());
  }
}

window.MatrixRain = MatrixRain;
