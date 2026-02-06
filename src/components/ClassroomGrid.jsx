import React, { useRef, useState } from 'react';
import Draggable from 'react-draggable';
import StudentCard from './StudentCard';

const DraggableCard = ({ student, room, baseWidth, baseHeight, scale, onSubjectClick, onDrop, onDragStart, onDragStop, onContextMenu }) => {
    const nodeRef = useRef(null); // Draggable ref
    const contentRef = useRef(null); // Inner content ref
    const [isExpanded, setIsExpanded] = useState(false); // Default collapsed

    // Apply 20% scale boost ONLY when expanded (User Req set to 20%)
    const currentScale = isExpanded ? scale * 1.2 : scale;

    const [dimensions, setDimensions] = useState({ width: baseWidth * currentScale, height: 80 * currentScale });

    const [isDragging, setIsDragging] = useState(false);

    // Measure content size whenever state changes (expanded/collapsed)
    React.useLayoutEffect(() => {
        if (contentRef.current) {
            // We measure the inner content's unscaled size
            const { offsetWidth, offsetHeight } = contentRef.current;

            // Update wrapper dimensions based on actual content size * scale
            setDimensions({
                width: offsetWidth * currentScale,
                height: offsetHeight * currentScale
            });
        }
    }, [isExpanded, currentScale, student.name]); // Re-measure if name changes or expand toggles

    const toggleExpand = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <Draggable
            nodeRef={nodeRef}
            defaultPosition={{ x: student.x || 0, y: student.y || 0 }}
            onStart={() => {
                setIsDragging(true);
                if (onDragStart) onDragStart();
            }}
            onStop={(e) => {
                setIsDragging(false);
                if (onDragStop) onDragStop();
                // Pass drop event up with coordinates AND the node (card) for rect calculation
                if (onDrop) {
                    // We need the ACTUAL current rect of the card to calculate offset relative to new container
                    const rect = nodeRef.current ? nodeRef.current.getBoundingClientRect() : null;
                    onDrop(student, { x: e.clientX, y: e.clientY }, rect);
                }
            }}
        >
            <div
                ref={nodeRef}
                className="card-wrapper"
                // Position absolute to prevent vertical stack and allow free movement
                style={{
                    position: 'absolute',
                    width: `${dimensions.width}px`,
                    height: `${dimensions.height}px`,
                    cursor: 'grab',
                    zIndex: isDragging ? 1000 : (isExpanded ? 100 : 10),
                    transition: isDragging ? 'none' : 'width 0.3s ease, height 0.3s ease',
                    // Remove margin since we are absolute
                    // marginBottom: isExpanded ? '0px' : '10px' 
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation(); // Prevent bubbling issues
                    toggleExpand();
                }}
            >
                <div
                    ref={contentRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        // If expanded, enforce baseWidth. If collapsed, let it be auto/fit-content.
                        width: isExpanded ? `${baseWidth}px` : 'max-content',
                        transform: `scale(${currentScale})`,
                        transformOrigin: 'top left',
                        // We need to ensure the transformation doesn't clip if we measure locally
                        // But since transform doesn't affect flow, we just measure unscaled.
                    }}
                >
                    <StudentCard
                        student={student}
                        room={room}
                        expanded={isExpanded}
                        onToggleExpand={toggleExpand}
                        onSubjectClick={onSubjectClick}
                        onContextMenu={onContextMenu}
                    />
                </div>
            </div>
        </Draggable>
    );
};

const ClassroomGrid = ({ students, room, onSubjectClick, onDrop, onDragStart, onDragStop, resetKey, onContextMenu }) => {
    // Reverted to original scale (User request: keep collapsed size same)
    const SCALE = 0.48;
    // Base dimensions reverted to original (242/220)
    const BASE_WIDTH = 242;
    const BASE_HEIGHT = 220;
    const COLLAPSED_HEIGHT = 80 * SCALE;


    // Dynamic height removed for rigid layout
    const containerHeight = '100%';

    return (
        <div className="classroom-grid" style={{ height: '100%', flexShrink: 0 }}>
            {students.map((student) => (
                <DraggableCard
                    // Combine ID with resetKey to force re-mount on reset
                    key={`${student.id}-${resetKey}`}
                    student={student}
                    room={room}
                    baseWidth={BASE_WIDTH}
                    baseHeight={BASE_HEIGHT}
                    scale={SCALE}
                    onSubjectClick={onSubjectClick}
                    onDrop={onDrop}
                    onDragStart={onDragStart}
                    onDragStop={onDragStop}
                    onContextMenu={onContextMenu}
                />
            ))}
        </div>
    );
};

export default ClassroomGrid;
