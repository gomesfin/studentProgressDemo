# Hawkings High Student Dashboard

## Overview

The **Hawkings High Student Dashboard** is a web application designed to solve real-world problems in classroom management. It empowers educators with a unified interface to track student progress, monitor attendance, and intervene early for at-risk students.

This project was built to demonstrate proficiency in modern frontend development, state management, and data visualization.

## Technical Highlights

### Core Technologies
- **Frontend Framework**: React 19 
- **Build Tool**: Vite
- **Language**: JavaScript 
- **State Management**: React Context API & Reducers (managing complex, cross-component state)

### Key Features & Implementation Details

#### 1. Interactive Seating Charts (Drag & Drop)
- **Challenge**: Creating a flexible layout system that mimics a physical classroom.
- **Solution**: implemented `react-draggable` to allow teachers to customize seating arrangements. Coordinates are persisted to ensure the layout remains consistent between sessions.

#### 2. Advanced Data Visualization
- **Challenge**: Displaying complex multi-dimensional data (assignments, grades, attendance) without overwhelming the user.
- **Solution**: Built custom, lightweight SVG graphs instead of relying on heavy charting libraries. This allows for pixel-perfect control over the design and better performance.

#### 3. Intelligent Data Import & Fuzzy Matching
- **Challenge**: External data sources (CSVs) often have inconsistent naming conventions (e.g., "Jon Doe" vs "Jonathan Doe").
- **Solution**: Implemented a Levenshtein distance algorithm to detect near-matches during import. The UI presents these "fuzzy matches" to the user for manual verification, preventing data duplication.

#### 4. Real-Time Performance Optimized
- **Challenge**: Rendering hundreds of student data points simultaneously.
- **Solution**: Utilized extensive memoization (`useMemo`, `useCallback`) and virtualized lists where appropriate to ensure the application runs smoothly even on lower-end school hardware.

## Getting Started

To run this project locally:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/student-dashboard.git
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Start the development server**:
    ```bash
    npm run dev
    ```

## Future Improvements

- **backend Integration**: Transitioning from Supabase/Mock data to a full Node.js/Express backend.
- **TypeScript Migration**: Rewriting core logic in TypeScript for better type safety.
- **Unit Testing**: Implementing Vitest and React Testing Library for robust test coverage.

---

*This project is part of my professional portfolio. Feel free to reach out if you have any questions!*
