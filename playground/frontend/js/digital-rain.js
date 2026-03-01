/**
 * digital-rain.js — Digital Matrix rain effect for modal overlays
 * Creates authentic Matrix-style falling characters animation
 */

class DigitalRain {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    
    // Matrix characters (Katakana + numbers + ASCII)
    this.chars = '01ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾙﾚﾜﾝ';
    this.fontSize = 19;
    this.columns = 0;
    this.drops = [];
    this.speeds = []; // Random speed for each column
    this.resetThresholds = []; // Random reset point for each column
    
    this.init();
  }

  init() {
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.zIndex = '1';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.opacity = '0.15';
    
    this.container.insertBefore(this.canvas, this.container.firstChild);
    this.ctx = this.canvas.getContext('2d');
    
    // Set up canvas
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Set font
    this.ctx.font = `bold ${this.fontSize}px 'Share Tech Mono', monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    
    // Start animation
    this.animate();
  }

  resize() {
    this.canvas.width = this.container.offsetWidth;
    this.canvas.height = this.container.offsetHeight;
    
    // Calculate columns based on font size
    this.columns = Math.floor(this.canvas.width / this.fontSize);
    
    // Reinitialize drops with random starting heights
    this.drops = [];
    this.speeds = [];
    this.resetThresholds = [];
    
    for (let i = 0; i < this.columns; i++) {
      this.drops[i] = Math.random() * -50;
      // Random speed between 0.08 and 0.20 (very slow)
      this.speeds[i] = 0.05 + Math.random() * 0.30;
      // Random reset threshold (0.95 to 0.99) for varying trail lengths
      this.resetThresholds[i] = 0.95 + Math.random() * 0.04;
    }
  }

  animate() {
    // Semi-transparent black creates the fade trail effect
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Set text color (reduced opacity)
    this.ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
    
    for (let i = 0; i < this.drops.length; i++) {
      // Random character
      const char = this.chars[Math.floor(Math.random() * this.chars.length)];
      const x = i * this.fontSize;
      const y = this.drops[i] * this.fontSize;
      
      this.ctx.fillText(char, x, y);
      
      // Reset drop randomly after reaching bottom (using individual threshold)
      if (y > this.canvas.height && Math.random() > this.resetThresholds[i]) {
        this.drops[i] = Math.random() * -5; // Add some randomness to restart position
        // Occasionally change the reset threshold for more variation
        if (Math.random() > 0.98) {
          this.resetThresholds[i] = 0.75 + Math.random() * 0.04;
        }
      }
      
      // Use individual speed for each column
      this.drops[i] += this.speeds[i];
    }
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

window.DigitalRain = DigitalRain;

