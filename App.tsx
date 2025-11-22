import React, { useState } from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { ClassScreen } from './screens/ClassScreen';
import { Classroom } from './types';

const App: React.FC = () => {
  const [selectedClass, setSelectedClass] = useState<Classroom | null>(null);

  if (selectedClass) {
    return (
      <ClassScreen 
        classroom={selectedClass} 
        onBack={() => setSelectedClass(null)} 
      />
    );
  }

  return <HomeScreen onSelectClass={setSelectedClass} />;
};

export default App;
