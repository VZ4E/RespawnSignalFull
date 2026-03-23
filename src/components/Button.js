/**
 * Button Component
 * Reusable button with multiple variants: primary, secondary, outline
 */
class Button {
  static VARIANTS = {
    primary: 'h-12 px-6 bg-primary text-white rounded-lg hover:bg-blue-600 font-medium transition-colors',
    secondary: 'h-10 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors',
    outline: 'h-10 px-4 border border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 font-medium transition-colors',
  };

  static create(label, variant = 'primary', onClick = null) {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = Button.VARIANTS[variant] || Button.VARIANTS.primary;
    
    if (onClick) {
      button.addEventListener('click', onClick);
    }
    
    return button;
  }

  static createPrimary(label, onClick) {
    return Button.create(label, 'primary', onClick);
  }

  static createSecondary(label, onClick) {
    return Button.create(label, 'secondary', onClick);
  }

  static createOutline(label, onClick) {
    return Button.create(label, 'outline', onClick);
  }
}
