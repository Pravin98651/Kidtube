import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface MathTollboothProps {
  onSuccess: () => void;
}

export default function MathTollbooth({ onSuccess }: MathTollboothProps) {
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [operator, setOperator] = useState('+');
  const [userAnswer, setUserAnswer] = useState('');
  const [error, setError] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  useEffect(() => {
    generateQuestion();
  }, []);

  const generateQuestion = (isEasyMode = false) => {
    const isAdd = isEasyMode ? true : Math.random() > 0.5;
    let n1, n2;
    if (isAdd) {
      n1 = isEasyMode ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 9) + 1;
      n2 = isEasyMode ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 9) + 1;
      setOperator('+');
    } else {
      n1 = Math.floor(Math.random() * 9) + 5;
      n2 = Math.floor(Math.random() * n1) + 1;
      setOperator('-');
    }
    setNum1(n1);
    setNum2(n2);
    setUserAnswer('');
    setError(false);
  };

  const handlePress = (val: string) => {
    setError(false);
    if (val === 'DEL') {
      setUserAnswer(prev => prev.slice(0, -1));
    } else if (val === 'OK') {
      const correctAnswer = operator === '+' ? num1 + num2 : num1 - num2;
      if (parseInt(userAnswer) === correctAnswer) {
        setFailedAttempts(0);
        onSuccess();
      } else {
        setError(true);
        setUserAnswer('');
        const newFails = failedAttempts + 1;
        setFailedAttempts(newFails);
        if (newFails >= 3) {
          generateQuestion(true); // Switch to easy mode
        }
      }
    } else {
      if (userAnswer.length < 3) {
        setUserAnswer(prev => prev + val);
      }
    }
  };

  const padButtons = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'OK'];

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Unlock Next Video!</Text>
        <Text style={styles.subtitle}>Solve this math problem to continue watching.</Text>

        <View style={styles.questionContainer}>
          <Text style={styles.questionText}>{num1} {operator} {num2} = {userAnswer || '?'}</Text>
        </View>

        {error && <Text style={styles.errorText}>Oops! Try again.</Text>}

        <View style={styles.keypad}>
          {padButtons.map(btn => (
            <TouchableOpacity 
              key={btn} 
              style={[
                styles.keypadButton, 
                btn === 'OK' && styles.okButton,
                btn === 'DEL' && styles.delButton
              ]}
              onPress={() => handlePress(btn)}
            >
              <Text style={[
                styles.keypadButtonText,
                (btn === 'OK' || btn === 'DEL') && styles.actionButtonText
              ]}>{btn}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 30,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  questionContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 40,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  questionText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#111',
    letterSpacing: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
  },
  keypadButton: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  okButton: {
    backgroundColor: '#10B981',
  },
  delButton: {
    backgroundColor: '#EF4444',
  },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  actionButtonText: {
    fontSize: 20,
    color: '#FFF',
  }
});
