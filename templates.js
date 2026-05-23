const templates = {
    welcome: "Hi {{name}}! 👋 Welcome to our platform. We are thrilled to have you with us! Let us know if you have any questions.",
    reminder: "Hi {{name}}, this is a friendly reminder regarding your booking. Please check your account for details.",
    default: "Hello {{name}}! Hope you are having a wonderful day."
};

/**
 * Renders a template with provided variables
 * @param {string} templateName - Name of the template to render
 * @param {Object} variables - Key-value pairs for placeholders (e.g. { name: 'Alex' })
 * @returns {string} - Rendered message
 */
function renderTemplate(templateName, variables = {}) {
    const templateText = templates[templateName] || templates.default;
    let rendered = templateText;
    
    // Replace placeholders like {{key}}
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        rendered = rendered.replace(regex, String(value || ''));
    }
    
    // Clean up any remaining unresolved placeholders
    rendered = rendered.replace(/{{\s*\w+\s*}}/g, '');
    
    return rendered;
}

module.exports = {
    templates,
    renderTemplate
};
