
# Design Specifications

> [!IMPORTANT]
> This document serves as the **Source of Truth** for UI/UX elements.
> **DO NOT** modify these design tokens during refactors without explicit user approval.
> These specs are critical for maintaining the "Current State" and preventing regression loops.

## Calendar Modal (`CalendarModal.jsx`)

### Global Modal Styles

- **Background**: `#1e293b` (Slate-900)
- **Max Width**: `1250px` (Expanded)
- **Border**: `1px solid rgba(255, 255, 255, 0.1)`
- **Padding**: Header/Body `1rem 2rem`
- **Header Features**:
  - **Student Toggle**: Dropdown with white background options for visibility.
  - **Homeroom Label**: Small, uppercase label (e.g., "SCIENCE HR") next to dropdowns (Opacity 0.5).
  - **Export Button**: "Ghost" style button (left of Close) to download PNG snapshot.
  - **Context**: Maintains `currentSubject` when switching students.

## Student Progress Graph

### Layout & Dimensions

- **SVG Width**: `1150px`
- **SVG Height**: `180px` (Compact)
- **Internal Padding**:
  - Top: `20px`
  - Right: `50px`
  - Bottom: `30px`
  - Left: `45px`
- **X-Axis Tick Density**: Display every **2nd** label only.

### Typography & Positioning

#### Axis Titles

- **Font**: `Inter, system-ui`, size `10px`, weight `600`, letter-spacing `1px`.
- **Left Axis Title**: "ACTIVITIES COMPLETED"
  - Color: **Subject Dynamic** (Matches line color)
  - Orientation: Rotated -90deg
- **Right Axis Title**: "AVG GRADE | COMPLETION"
  - Color: "AVG GRADE" (`#e2e8f0`), "|" (`#64748b`), "COMPLETION" (`#87A96B`)
  - Orientation: Rotated -90deg
  - **Start Y-Position**: `width - 2` (approx. `1148px`) -> Pushed to far right edge.

#### Tick Labels

- **Left Axis (Count)**:
  - Color: `#94a3b8`
  - Size: `11px`, Weight `600`
  - **X-Position**: `35` (Tight to graph line)
- **Right Axis (Percentage)**:
  - Color: `#64748b`
  - Size: `9px`, Weight `600`
  - **X-Position**: `width - 45` (1105px)
- **X-Axis (Weeks)**:
  - Color: `#64748b`
  - Size: `10px`
  - Position: `height - 5`

### Graph Elements

- **Grid Lines**: Horizontal only (Right Axis scale), Stroke `#334155`, Dash `3 3`, Width `1`.
- **Data Series**:

| Series | Type | Color | Stroke Style | Node Style | Shading |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Activity Count** | Line | Subject Dynamic | Solid, Width 2 | **Hollow**: Fill `#0f172a`, Stroke Subject Color, `r=3.5` | None |
| **Average Grade** | Line | `#e2e8f0` (White/Grey) | **Dashed**: `4 4`, Width 1.5 | **Hollow**: Fill `#0f172a`, Stroke `#e2e8f0`, `r=3` | None |
| **Class Completion** | Line + Area | `#87A96B` (Muted Green) | Solid, Width 2 | **Solid**: Fill `#87A96B`, `r=2.5` | Fill `#87A96B`, Opacity **0.15** |

### Subject Colors (Updated)

- **Science**: `#2dd4bf` (Teal)
- **Math**: `#60a5fa` (Blue)
- **English**: `#f87171` (Rose)
- **Social Studies**: `#a78bfa` (Purple)

## Behavior Graph (Footer)

### Layout

- **Dimensions**: `1150px` x `90px` (Increased Height)
- **Padding**: Top `15px`, Right `50px`, Bottom `20px`, Left `45px`
- **Grid**: 3 lines (Top, Middle, Bottom), Stroke `#334155`, Dash `2 2`, Width `0.5`.

### Dual Y-Axes & Styling

- **Left Axis (Absences)**:
  - Color: `#7dd3fc` (Sky-300) -> Cool/Airy
  - Scale: 0 to Max (Min 5)
  - Label: "ABSENCES" (Rotated -90deg, `y=12`)
- **Right Axis (Write-ups)**:
  - Color: `#fdba74` (Orange-300) -> Warm/Caution
  - Scale: 0 to Max (Min 3)
  - Label: "WRITE-UPS" (Rotated -90deg, `y=width-8`)

### Data Series

- **Absences**:
  - Color: `#7dd3fc`
  - Style: Line (Width 2) + Circle (`r=2.5`)
- **Write-ups**:
  - Color: `#fdba74`
  - Style: Line (Width 2) + Circle (`r=2.5`)

## Filter Modal (`FilterModal.jsx`)

### File Structure

- **Styles**: Scoped to `src/components/FilterModal.css` to prevent regression.
- **Root Class**: `.filter-modal`

### Aesthetics

- **Theme**: Premium Dark (Matches Calendar Modal)
  - **Header**: `#0f172a` (Slate-950)
  - **Body**: `#1e293b` (Slate-900)
- **Controls**: "Ghost" style (Transparent bg, White border `rgba(255,255,255,0.2)`).

### Header Layout

- **Title**: Displays **Homeroom Label** only (e.g., `SCIENCE HR`).
  - **Color**: Pure White (`#ffffff`), `opacity: 1`.
  - **Style**: Uppercase, Bold (`700`), Size `0.95rem`, Text Shadow.
- **Close Button**:
  - **Type**: Text Button ("Close")
  - **Style**: Ghost button, consistent with Calendar Modal.

### Control Layout (Top to Bottom)

1. **Time Window**: Start/End Date.
2. **Class**: Filter by enrolled class (Label: "Class").
3. **Grades**: 9th-12th checkboxes.
    - **Layout**: Single line grid (`grid-template-columns: repeat(4, 1fr)`).
4. **Academics**: Min Assignments | Min Progress (Side-by-side).
5. **Behavior**: Min Attendance | Max Write-ups (Side-by-side).

## Class History & Verification Modals

### Global Theme: Glassmorphism Premium

Shared styles for `ProgressHistoryModal` and `ImportSummaryModal`.

- **Background**: `#1e293b` (Slate-900)
- **Border**: `1px solid rgba(255, 255, 255, 0.1)`
- **Shadow**: `0 25px 50px -12px rgba(0, 0, 0, 0.5)`
- **Border Radius**: `16px`
- **Animation**: `modalFadeIn 0.2s ease-out`

### Typography & Gradients

- **Headers (`h3`)**:
  - Font Size: `1.5rem`
  - Weight: `700`
  - **Gradient**: `linear-gradient(90deg, #fff, #a5b4fc)` (White to Indigo-300)
  - Text Fill: Transparent (Background Clip)

### Status Indicators (Health/Data Quality)

Standardized color tokens for data status across the application:

| Status | Color | Background (Opacity 0.15) | Border |
| :--- | :--- | :--- | :--- |
| **Good / Complete** | `#10b981` (Emerald) | `rgba(16, 185, 129, 0.15)` | Transparent |
| **Partial Data** | `#f59e0b` (Amber) | `rgba(245, 158, 11, 0.15)` | Transparent |
| **Missing / Issue** | `#ef4444` (Red) | `rgba(239, 68, 68, 0.15)` | `rgba(239, 68, 68, 0.3)` |

### Component: Verification Analysis

#### View Toggle Pill

- **Container**: `rgba(255, 255, 255, 0.05)` rounded pill.
- **Active State**: `#4f46e5` (Indigo-600) background, White text, Shadow.
- **Inactive**: Text `#94a3b8`, Transparent background.

#### Student Row (List View)

- **Background**: `rgba(255, 255, 255, 0.03)`
- **Border**: `1px solid rgba(255, 255, 255, 0.05)`
- **Hover**: Lightens to `rgba(255, 255, 255, 0.05)`
- **Expansion**: Reveals grid of `class-card` items.

#### Class Cards (Grid)

- **Layout**: `grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`
- **Details**:
  - **Left Border**: 3px solid (Color matches Status)
  - **Background**: `rgba(255, 255, 255, 0.03)` -> `rgba(239, 68, 68, 0.05)` if missing.
