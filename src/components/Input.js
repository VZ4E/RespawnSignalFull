/**
 * Input Component
 * Text input with h-10 height, focus ring styling, and consistent border
 */
class Input {
  static create(id, placeholder = '', type = 'text', label = null) {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';
    
    if (label) {
      const labelEl = document.createElement('label');
      labelEl.htmlFor = id;
      labelEl.className = 'block text-sm font-medium text-gray-700 mb-2';
      labelEl.textContent = label;
      wrapper.appendChild(labelEl);
    }
    
    const input = document.createElement('input');
    input.id = id;
    input.type = type;
    input.placeholder = placeholder;
    input.className = 'w-full h-10 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500 transition-colors';
    
    wrapper.appendChild(input);
    return wrapper;
  }

  static createTextarea(id, placeholder = '', label = null, rows = 4) {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-group';
    
    if (label) {
      const labelEl = document.createElement('label');
      labelEl.htmlFor = id;
      labelEl.className = 'block text-sm font-medium text-gray-700 mb-2';
      labelEl.textContent = label;
      wrapper.appendChild(labelEl);
    }
    
    const textarea = document.createElement('textarea');
    textarea.id = id;
    textarea.placeholder = placeholder;
    textarea.rows = rows;
    textarea.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500 transition-colors';
    
    wrapper.appendChild(textarea);
    return wrapper;
  }
}
