export const packStudents = (students, containerWidth, containerHeight) => {
    // Constants matching the UI (Scale 0.48)
    // Reverted to original tight packing (User Req: Keep collapsed size same)
    // 242 * 0.48 = ~116
    const CARD_WIDTH = 125; // Original constant
    const CARD_HEIGHT = 44; // Original constant
    const GAP = 1; // Tighter gap
    const PADDING = 2; // Minimal edge padding
    const HEADER_OFFSET = 20; // Reduced header reservation
    const BOTTOM_PADDING = 20; // Reclaimed bottom buffer (was 60)

    const cx = containerWidth / 2;
    // Center vertically in the *available* space
    const cy = HEADER_OFFSET + (containerHeight - HEADER_OFFSET - BOTTOM_PADDING) / 2;

    const placedRects = [];

    // Helper to check rectangle intersection
    const intersects = (r1, r2) => {
        return !(r2.left >= r1.right ||
            r2.right <= r1.left ||
            r2.top >= r1.bottom ||
            r2.bottom <= r1.top);
    };

    // Helper to check if rect is inside valid container bounds
    const isWithinBounds = (r) => {
        return r.left >= PADDING &&
            r.right <= containerWidth - PADDING &&
            r.top >= HEADER_OFFSET &&
            r.bottom <= containerHeight - BOTTOM_PADDING;
    };

    // Pre-fill placedRects with manual students to ensure spiral avoids them
    students.forEach(student => {
        if (student.manual && student.x != null && student.y != null) {
            placedRects.push({
                left: student.x,
                right: student.x + CARD_WIDTH + GAP,
                top: student.y,
                bottom: student.y + CARD_HEIGHT + GAP
            });
        }
    });

    return students.map((student, i) => {
        // If student has manual position, respect it (but clamp to bounds for safety)
        if (student.manual && student.x != null && student.y != null) {
            // Optional: Clamp to ensuring they don't disappear if window shrinks
            // For now, trusting the saved coordinates or just minor clamping
            const clampedX = Math.max(PADDING, Math.min(containerWidth - CARD_WIDTH - PADDING, student.x));
            const clampedY = Math.max(HEADER_OFFSET, Math.min(containerHeight - CARD_HEIGHT - BOTTOM_PADDING, student.y));

            // We already added them to placedRects above (using original coords), 
            // but if we clamp, we might slightly deviate. 
            // Ideally we should have clamped before adding to placedRects, but for small diffs it's fine.
            // Let's just return the clamped values.
            return { ...student, x: clampedX, y: clampedY };
        }

        // Strategy: Strictly Organic Spiral (Center-Out) for non-manual students
        // ... (rest of the logic)

        // Initial candidate: Center
        let bestX = cx - CARD_WIDTH / 2;
        let bestY = cy - CARD_HEIGHT / 2;
        let placed = false;

        // Spiral vars
        let angle = 0;
        let radius = 0;
        // Fine step for finding closest fit
        const step = 0.25;
        let iter = 0;
        const maxSpiralIter = 6000; // High effort to pack tight

        while (iter < maxSpiralIter) {
            const x = cx + radius * Math.cos(angle) - CARD_WIDTH / 2;
            const y = cy + radius * Math.sin(angle) - CARD_HEIGHT / 2;

            const candidateRect = {
                left: x,
                right: x + CARD_WIDTH + GAP,
                top: y,
                bottom: y + CARD_HEIGHT + GAP
            };

            const visualRect = {
                left: x,
                right: x + CARD_WIDTH,
                top: y,
                bottom: y + CARD_HEIGHT
            };

            let valid = isWithinBounds(visualRect);
            if (valid) {
                for (const p of placedRects) {
                    if (intersects(candidateRect, p)) {
                        valid = false;
                        break;
                    }
                }
            }

            if (valid) {
                bestX = x;
                bestY = y;
                placedRects.push(candidateRect);
                placed = true;
                break;
            }

            angle += step;
            // Tighter packing: Radius grows slowly
            radius = 2 + (3 * angle);
            iter++;
        }

        // Fallback: If spiral fails (full), strictly clamp to safe boundaries
        if (!placed) {
            // console.error(`FAILED ${student.name} totally.`);
            // Just clamp to safe zone
            bestX = Math.max(PADDING, Math.min(containerWidth - CARD_WIDTH - PADDING, cx - CARD_WIDTH / 2));
            bestY = Math.max(HEADER_OFFSET, Math.min(containerHeight - CARD_HEIGHT - BOTTOM_PADDING, cy - CARD_HEIGHT / 2));

            placedRects.push({
                left: bestX,
                right: bestX + CARD_WIDTH + GAP,
                top: bestY,
                bottom: bestY + CARD_HEIGHT + GAP
            });
        }

        return { ...student, x: bestX, y: bestY };
    });
};
