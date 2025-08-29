// Minimal Bootstrap JS replacements for popup
class BootstrapModal {
    constructor(element) {
        this.element = element;
    }
    
    show() {
        this.element.classList.add('show');
        this.element.style.display = 'block';
        document.body.classList.add('modal-open');
    }
    
    hide() {
        this.element.classList.remove('show');
        this.element.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
    
    static getInstance(element) {
        return new BootstrapModal(element);
    }
}

class BootstrapToast {
    constructor(element) {
        this.element = element;
    }
    
    show() {
        this.element.classList.add('show');
        setTimeout(() => {
            this.hide();
        }, 3000);
    }
    
    hide() {
        this.element.classList.remove('show');
    }
    
    static getInstance(element) {
        return new BootstrapToast(element);
    }
}

class BootstrapDropdown {
    constructor(element) {
        this.element = element;
        this.menu = element.nextElementSibling;
        this.isOpen = false;
        
        this.element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });
        
        document.addEventListener('click', (e) => {
            if (!this.element.contains(e.target) && !this.menu.contains(e.target)) {
                this.hide();
            }
        });
    }
    
    toggle() {
        if (this.isOpen) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    show() {
        this.menu.classList.add('show');
        this.isOpen = true;
    }
    
    hide() {
        this.menu.classList.remove('show');
        this.isOpen = false;
    }
    
    static getInstance(element) {
        return new BootstrapDropdown(element);
    }
}

// Global Bootstrap object for compatibility
window.bootstrap = {
    Modal: BootstrapModal,
    Toast: BootstrapToast,
    Dropdown: BootstrapDropdown
};

// Auto-initialize dropdowns
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach(element => {
        new BootstrapDropdown(element);
    });
});

// Initialize modal close functionality
document.addEventListener('DOMContentLoaded', () => {
    // Handle modal close buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-close') || 
            e.target.getAttribute('data-bs-dismiss') === 'modal') {
            const modal = e.target.closest('.modal');
            if (modal) {
                const modalInstance = new BootstrapModal(modal);
                modalInstance.hide();
            }
        }
    });
    
    // Handle modal backdrop clicks
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            const modalInstance = new BootstrapModal(e.target);
            modalInstance.hide();
        }
    });
});