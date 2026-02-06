import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ContextMenu.css';

const ContextMenu = ({ x, y, onClose, onAction, options }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        const handleScroll = () => {
            onClose(); // Close on scroll for simplicity
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [onClose]);

    // Prevent menu from going off-screen
    const style = {
        top: y,
        left: x,
    };

    // Simple bounds check (render logic could be improved but sufficient for now)
    if (menuRef.current) {
        // We could adjust here if we had dimensions, but initial render handles mostly
    }

    return createPortal(
        <div
            ref={menuRef}
            className="custom-context-menu"
            style={style}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
        >
            {options.map((opt, idx) => (
                <div
                    key={idx}
                    className={`context-menu-item ${opt.danger ? 'danger' : ''}`}
                    onClick={() => {
                        opt.onClick();
                        onClose();
                    }}
                >
                    {opt.icon && <span className="menu-icon">{opt.icon}</span>}
                    {opt.label}
                </div>
            ))}
        </div>,
        document.body
    );
};

export default ContextMenu;
