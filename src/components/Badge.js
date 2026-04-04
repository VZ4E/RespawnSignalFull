/**
 * Badge Component
 * Pill-style badges with primary color scheme
 */
class Badge {
  static create(text, variant = 'primary') {
    const badge = document.createElement('span');
    
    const baseClasses = 'inline-block px-3 py-1 rounded-full text-xs font-medium';
    
    const variants = {
      primary: `${baseClasses} bg-primary-light text-primary-text`,
      success: `${baseClasses} bg-green-100 text-green-700`,
      warning: `${baseClasses} bg-yellow-100 text-yellow-700`,
      danger: `${baseClasses} bg-red-100 text-red-700`,
      neutral: `${baseClasses} bg-gray-100 text-gray-700`,
    };
    
    badge.className = variants[variant] || variants.primary;
    badge.textContent = text;
    
    return badge;
  }

  static createPrimary(text) {
    return Badge.create(text, 'primary');
  }

  static createSuccess(text) {
    return Badge.create(text, 'success');
  }

  static createWarning(text) {
    return Badge.create(text, 'warning');
  }

  static createDanger(text) {
    return Badge.create(text, 'danger');
  }
}
