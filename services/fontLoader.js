import * as Font from 'expo-font';
import { Platform } from 'react-native';
import {
  Ionicons,
  FontAwesome,
  FontAwesome5,
  MaterialCommunityIcons,
  MaterialIcons,
  Feather,
  AntDesign
} from '@expo/vector-icons';
import { useState, useEffect } from 'react';

// Map of all custom fonts and vector icon font families
export const APP_FONTS = {
  // Vector Icons
  ...Ionicons.font,
  ...FontAwesome.font,
  ...FontAwesome5.font,
  ...MaterialCommunityIcons.font,
  ...MaterialIcons.font,
  ...Feather.font,
  ...AntDesign.font,

  // Nokia Pure Headline Typography Family
  'Nokia Pure Headline': require('../assets/fonts/NokiaPureHeadline-Regular.ttf'),
  'NokiaPureHeadline-Regular': require('../assets/fonts/NokiaPureHeadline-Regular.ttf'),
  'NokiaPureHeadline-Light': require('../assets/fonts/NokiaPureHeadline-Light.ttf'),
  'NokiaPureHeadline-UltraLight': require('../assets/fonts/NokiaPureHeadline-UltraLight.ttf'),
  'NokiaPureHeadline-Bold': require('../assets/fonts/NokiaPureHeadline-Bold.ttf'),
  'NokiaPureHeadline-ExtraBold': require('../assets/fonts/NokiaPureHeadline-ExtraBold.ttf'),
};

let fontsLoadingPromise = null;

/**
 * Loads all application fonts asynchronously.
 */
export const loadAppFontsAsync = async () => {
  if (fontsLoadingPromise) return fontsLoadingPromise;

  fontsLoadingPromise = (async () => {
    try {
      await Font.loadAsync(APP_FONTS);
    } catch (error) {
      console.warn("W3Labs-Agro: Aviso ao carregar fontes via expo-font:", error);
    }
  })();

  return fontsLoadingPromise;
};

/**
 * React hook to ensure fonts are loaded before displaying UI.
 */
export function useAppFonts() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    loadAppFontsAsync()
      .then(() => {
        if (isMounted) setFontsLoaded(true);
      })
      .catch((err) => {
        if (isMounted) {
          setFontError(err);
          setFontLoaded(true); // Don't block app indefinitely
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { fontsLoaded, fontError };
}
