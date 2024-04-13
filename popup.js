import React, { useState, useEffect } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity } from 'react-native';

const WarningPopup = () => {
  const [visible, setVisible] = useState(false);
  const position = new Animated.Value(-60); // Démarre hors de l'écran

  // Fonction pour animer le popup à l'entrée
  const slideIn = () => {
    Animated.timing(position, {
      toValue: 0, // L'amène à la position visible
      duration: 500, // Temps de l'animation en ms
      useNativeDriver: true, // Utilisation du pilote natif pour une meilleure performance
    }).start();
  };

  // Fonction pour animer le popup à la sortie
  const slideOut = () => {
    Animated.timing(position, {
      toValue: -60, // Le ramène hors de l'écran
      duration: 500,
      useNativeDriver: true,
    }).start(() => setVisible(false)); // Cache le popup après l'animation
  };

  // Montre le popup et le cache après 3 secondes
  useEffect(() => {
    if (visible) {
      slideIn();
      setTimeout(slideOut, 3000); // Remplacez 3000 par la durée souhaitée d'affichage
    }
  }, [visible]);

  // Exemple d'utilisation, pourrait être déclenché par un événement
  const togglePopup = () => {
    setVisible(!visible);
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.popup, { transform: [{ translateY: position }] }]}>
      <Text style={styles.text}>Attention! Ceci est un avertissement.</Text>
      <TouchableOpacity onPress={slideOut}>
        <Text style={styles.closeButton}>X</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  popup: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'red',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
  },
  closeButton: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default WarningPopup;
