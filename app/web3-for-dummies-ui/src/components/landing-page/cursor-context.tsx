import React, { createContext, useContext, useState } from 'react';

type CursorContextType = {
  isHovering: boolean;
  setIsHovering: (hovering: boolean) => void;
};

const CursorContext = createContext<CursorContextType>({
  isHovering: false,
  setIsHovering: () => {},
});

export const CursorProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [isHovering, setIsHovering] = useState(false);
  
  return (
    <CursorContext.Provider value={{ isHovering, setIsHovering }}>
      {children}
    </CursorContext.Provider>
  );
};

export const useCursor = () => useContext(CursorContext);

// Custom hook for interactive elements
export const useInteractive = () => {
  const { setIsHovering } = useCursor();
  
  return {
    onMouseEnter: () => setIsHovering(true),
    onMouseLeave: () => setIsHovering(false),
  };
};