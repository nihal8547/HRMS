# UI Standardization Guide

## Overview
The project now uses a comprehensive design system with standardized colors, components, and utilities for a consistent, minimal, and professional UI experience.

## Design System Location
- **Main Design System**: `src/styles/design-system.css`
- **Table Overrides**: `src/styles/table-overrides.css`
- **Imported in**: `src/index.css` and `src/main.tsx`

## Color Palette

### Primary Colors
- Primary: `#2563eb` (Blue)
- Primary Dark: `#1e40af`
- Primary Light: `#3b82f6`
- Primary Lighter: `#dbeafe`

### Neutral Colors
- White: `#ffffff`
- Gray Scale: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900

### Semantic Colors
- Success: `#10b981` (Green)
- Warning: `#f59e0b` (Orange)
- Error: `#ef4444` (Red)
- Info: `#3b82f6` (Blue)

## Standardized Components

### Buttons
Use the `.btn` class with variants:
- `.btn-primary` - Primary action (Blue)
- `.btn-secondary` - Secondary action (White with border)
- `.btn-success` - Success action (Green)
- `.btn-danger` - Danger action (Red)
- `.btn-warning` - Warning action (Orange)
- `.btn-outline` - Outline style
- `.btn-ghost` - Ghost style

Sizes:
- `.btn-sm` - Small
- Default - Medium
- `.btn-lg` - Large

**Example:**
```html
<button className="btn btn-primary">Save</button>
<button className="btn btn-secondary">Cancel</button>
<button className="btn btn-danger btn-sm">Delete</button>
```

### Tables
All tables automatically use standardized styling:
- Blue gradient header (`#2563eb` to `#1e40af`)
- White text on header
- Hover effects on rows
- Consistent padding and spacing

**Classes:**
- `.table-container` - Wrapper with card styling
- `.table-wrapper` - Scrollable container
- `.table` - Base table
- `.table-striped` - Alternating row colors
- `.table-bordered` - Bordered cells

**Example:**
```html
<div className="table-container">
  <div className="table-wrapper">
    <table className="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Department</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>John Doe</td>
          <td>IT</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### Status Badges
Use `.badge` class with variants:
- `.badge-primary` - Blue
- `.badge-success` - Green
- `.badge-warning` - Orange
- `.badge-error` - Red
- `.badge-info` - Light blue
- `.badge-gray` - Gray

**Example:**
```html
<span className="badge badge-success">Active</span>
<span className="badge badge-error">Inactive</span>
```

### Forms
Standardized form inputs:
- `.form-group` - Form field container
- `.form-label` - Label
- `.form-input` - Text input
- `.form-select` - Select dropdown
- `.form-textarea` - Textarea
- `.form-error` - Error message
- `.form-help` - Help text

**Example:**
```html
<div className="form-group">
  <label className="form-label">Name</label>
  <input type="text" className="form-input" />
  <div className="form-error">Error message</div>
</div>
```

### Cards
Use `.card` class:
- `.card-header` - Card header
- `.card-body` - Card content
- `.card-footer` - Card footer

**Example:**
```html
<div className="card">
  <div className="card-header">
    <h3>Title</h3>
  </div>
  <div className="card-body">
    Content here
  </div>
</div>
```

## Utility Classes

### Spacing
- `.mt-0` to `.mt-4` - Margin top
- `.mb-0` to `.mb-4` - Margin bottom
- `.p-0` to `.p-4` - Padding

### Text
- `.text-xs`, `.text-sm`, `.text-base`, `.text-lg`, `.text-xl` - Font sizes
- `.text-primary`, `.text-secondary`, `.text-tertiary` - Text colors
- `.font-normal`, `.font-medium`, `.font-semibold`, `.font-bold` - Font weights

### Display
- `.flex`, `.flex-col` - Flexbox
- `.items-center`, `.justify-between` - Flex alignment
- `.gap-2`, `.gap-3`, `.gap-4` - Gaps

### Background
- `.bg-white`, `.bg-gray-50`, `.bg-gray-100` - Background colors

### Borders & Shadows
- `.border`, `.border-t`, `.border-b` - Borders
- `.rounded`, `.rounded-lg` - Border radius
- `.shadow-sm`, `.shadow-md`, `.shadow-lg` - Shadows

## CSS Variables

All colors and spacing are available as CSS variables:

```css
/* Colors */
var(--color-primary)
var(--color-gray-50)
var(--text-primary)

/* Spacing */
var(--spacing-sm)
var(--spacing-md)
var(--spacing-lg)

/* Border Radius */
var(--radius-md)
var(--radius-lg)

/* Shadows */
var(--shadow-sm)
var(--shadow-md)
```

## Migration Checklist

- [x] Design system created
- [x] Table styles standardized
- [x] Button styles standardized
- [x] Form styles standardized
- [x] Badge styles standardized
- [x] Utility classes added
- [ ] Update existing pages to use new classes
- [ ] Remove duplicate CSS
- [ ] Test all pages for consistency

## Best Practices

1. **Always use design system classes** instead of inline styles
2. **Use CSS variables** for custom styling
3. **Follow the color palette** - don't use arbitrary colors
4. **Use utility classes** for spacing and layout
5. **Keep components minimal** - avoid unnecessary styling
6. **Maintain consistency** - use the same patterns across pages

## Table Header Color

All table headers now use a **blue gradient** (`#2563eb` to `#1e40af`) with white text for a professional, consistent look across the entire application.

