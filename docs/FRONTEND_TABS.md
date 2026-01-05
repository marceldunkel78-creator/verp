# Tab Scrolling Helper

This document describes the `.tab-scroll` utility added to the frontend to ensure tab bars show a horizontal scrollbar on small viewports (mobile/small browser window), similar to `/hr/employees`.

## Purpose
- Provide a consistent horizontal scrollbar for tab bars on small screens.
- Enable touch-friendly horizontal scrolling (`-webkit-overflow-scrolling: touch`).
- Ensure tab items don't wrap (inline presentation).

## Implementation
- CSS: `frontend/src/index.css` added under `@layer components`:
  - `.tab-scroll` sets `overflow-x: auto`, hides vertical overflow, and enables touch scrolling.
  - Adds wider horizontal scrollbar styling for better visibility on small devices.
  - Ensures direct children of `.tab-scroll` are `inline-flex` and `white-space: nowrap`.

## Pages updated
Applied `tab-scroll` to these pages' tab nav wrappers:

- `frontend/src/pages/EmployeeEdit.js` (already had overflow but retained behavior)
- `frontend/src/pages/Marketing.js` (already had overflow)
- `frontend/src/pages/MyVERP.js` (main tabs & message center)
- `frontend/src/pages/CustomerEdit.js`
- `frontend/src/pages/SystemEdit.js`
- `frontend/src/pages/CustomerOrderEdit.js`
- `frontend/src/pages/ServiceTicketEdit.js`
- `frontend/src/pages/VisiViewTicketEdit.js`
- `frontend/src/pages/VSServiceProductEdit.js`
- `frontend/src/pages/VSHardwareEdit.js`
- `frontend/src/pages/VisiviewProductEdit.js`
- `frontend/src/pages/TradingProductEdit.js`
- `frontend/src/pages/ProductCollectionEdit.js`
- `frontend/src/pages/SalesOrderForm.js`
- `frontend/src/pages/QuotationForm.js`
- `frontend/src/pages/SalesTicketEdit.js`
- `frontend/src/pages/DealerEdit.js`
- `frontend/src/pages/Inventory.js`
- `frontend/src/pages/InventoryItemEdit.js`
- `frontend/src/pages/PaymentDeliverySettings.js`
- `frontend/src/pages/OrderFormNew.js`

## How to use
Wrap your tab buttons in a `nav` element with class `tab-scroll` and an inline layout, e.g:

```html
<div class="border-b">
  <nav class="tab-scroll -mb-px flex space-x-4">
    <button class="whitespace-nowrap">Tab 1</button>
    <button class="whitespace-nowrap">Tab 2</button>
    <!-- ... -->
  </nav>
</div>
```

## Notes
- The helper is generic and can be applied to other tab-like horizontal controls.
- The custom scrollbar styling is limited to WebKit browsers; other browsers will fall back to native scrollbars.

If you'd like, I can add a unit/style test or a Storybook story to demonstrate the behavior across breakpoints.