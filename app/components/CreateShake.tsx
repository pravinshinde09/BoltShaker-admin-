import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Alert, StyleSheet, FlatList, Text, Image, ScrollView, Switch } from 'react-native';
import { createProduct, listProducts, createNutritionalDetails, getNutritionalDetailsById } from '../appwriteDB/appWriteService';
import { account } from '../appwrite/appWriteConfig';
import * as ImagePicker from 'expo-image-picker';
import { Models } from 'appwrite';
import { useLanguage } from '../context/LocalizationContext';
import { uploadImage } from './CloudinaryService';

type NutritionalDetails = {
  size: string;
  calories: string;
  fat: string;
  carbs : string;
  salt: string;
  proteins: string;
};

const CreateProductScreen = () => {
  const [title, setTitle] = useState({ en: '', fr: '', pl: '', de: '' });
  const [details, setDetails] = useState({ en: '', fr: '', pl: '', de: '' });
  const [price, setPrice] = useState({ USD: '', INR: '', EUR: '' });
  const [userId, setUserId] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [deleteToken, setDeleteToken] = useState<string | null>(null);
  const [products, setProducts] = useState<Models.Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { locale } = useLanguage();
  const [nutritionalDetails, setNutritionalDetails] = useState<NutritionalDetails>({
    size: '',
    calories: '',
    fat: '',
    carbs: '',
    proteins: '',
    salt: '',
  });
  const [isOutOfStock, setIsOutOfStock] = useState(false);
  const [nutritionalDetailsMap, setNutritionalDetailsMap] = useState<{ [key: string]: NutritionalDetails }>({});

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Sorry, we need camera roll permissions to make this work!');
      }
    })();
  }, []);

  const selectImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission denied', 'You need to grant access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        handleImagePick(result);
      } else {
        Alert.alert('Image selection canceled');
      }
    } catch (error) {
      console.error('Image selection error:', error);
      Alert.alert('Image selection failed', 'An error occurred while selecting your image');
    }
  };

  const handleImagePick = async (pickerResult: ImagePicker.ImagePickerResult) => {
    if (isUploading) return;
    setIsUploading(true);

    try {
      const data = await uploadImage(pickerResult);
      setImageUri(data.secure_url);
      setDeleteToken(data.delete_token);
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert('Image upload failed', 'An error occurred while uploading your image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    const parsedPriceUSD = parseFloat(price.USD);
    const parsedPriceINR = parseFloat(price.INR);
    const parsedPriceEUR = parseFloat(price.EUR);

    if (isNaN(parsedPriceUSD) || isNaN(parsedPriceINR) || isNaN(parsedPriceEUR)) {
      Alert.alert('Error', 'All prices must be valid numbers');
      return;
    }

    try {
      const detailsResponse = await createNutritionalDetails(nutritionalDetails);
      const nutritionalDetailsId = detailsResponse.$id;

      const product = {
        userId,
        title_en: title.en,
        title_fr: title.fr,
        title_pl: title.pl,
        title_de: title.de,
        details_en: details.en,
        details_fr: details.fr,
        details_pl: details.pl,
        details_de: details.de,
        price_USD: parsedPriceUSD,
        price_INR: parsedPriceINR,
        price_EUR: parsedPriceEUR,
        imageUrl: imageUri,
        nutritionalDetailsId,
        isOutOfStock,
        deleteToken,
      };

      const response = await createProduct(product);
      if (response) {
        Alert.alert('Product created successfully');
        setTitle({ en: '', fr: '', pl: '', de: '' });
        setDetails({ en: '', fr: '', pl: '', de: '' });
        setPrice({ USD: '', INR: '', EUR: '' });
        setImageUri(null);
        setDeleteToken(null);
        setNutritionalDetails({ size: '', calories: '',fat:'',carbs:'',proteins: '' , salt: '', });
        setIsOutOfStock(false);
        fetchProducts(userId);
      } else {
        Alert.alert('Error creating product');
      }
    } catch (error) {
      Alert.alert('Error', `Error creating product: ${(error as Error).message}`);
    }
  };

  const fetchNutritionalDetails = async (nutritionalDetailsId: string) => {
    try {
      const response = await getNutritionalDetailsById(nutritionalDetailsId);
      console.log("response:", response)
      if (response) {
        const nutritionalDetailsData: NutritionalDetails = {
          size: response.size || '',
          calories: response.calories || '',
          fat: response.fat || '',
          carbs: response.carbs || '',
          proteins: response.proteins || '',
          salt: response.salt || '',
        };
        setNutritionalDetails(nutritionalDetailsData);
      }
    } catch (error) {
      console.log('Error fetching Nutritional Details:', error);
    }
  };

  console.log('fetchNutritionalDetails:', fetchNutritionalDetails)

  const fetchProducts = async (userId: string) => {
    try {
      const response = await listProducts(userId);
      if (response) {
        setProducts(response);

        // Fetch nutritional details for each product
        const detailsMap: { [key: string]: NutritionalDetails } = {};
        for (const product of response) {
          if (product.nutritionalDetailsId) {
            const detailsResponse = await getNutritionalDetailsById(product.nutritionalDetailsId);
            if (detailsResponse) {
              detailsMap[product.$id] = {
                size: detailsResponse.size || '',
                calories: detailsResponse.calories || '',
                fat: detailsResponse.fat || '',
                carbs: detailsResponse.carbs || '',
                salt: detailsResponse.salt || '',
                proteins: detailsResponse.proteins || '',
              };
            }
          }
        }
        setNutritionalDetailsMap(detailsMap);
      }
    } catch (error) {
      console.log('Error fetching products:', error);
    }
  };

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await account.get();
        if (user) {
          setUserId(user.$id);
          fetchProducts(user.$id);
        }
      } catch (error) {
        console.log('Error fetching user:', error);
      }
    };

    fetchCurrentUser();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <TextInput
        placeholder="Name (English)"
        value={title.en}
        onChangeText={(text) => setTitle(prev => ({ ...prev, en: text }))}
        style={styles.input}
      />
      <TextInput
        placeholder="Name (French)"
        value={title.fr}
        onChangeText={(text) => setTitle(prev => ({ ...prev, fr: text }))}
        style={styles.input}
      />
      <TextInput
        placeholder="Name (Polish)"
        value={title.pl}
        onChangeText={(text) => setTitle(prev => ({ ...prev, pl: text }))}
        style={styles.input}
      />
      <TextInput
        placeholder="Name (German)"
        value={title.de}
        onChangeText={(text) => setTitle(prev => ({ ...prev, de: text }))}
        style={styles.input}
      />

      <TextInput
        placeholder="Description (English)"
        value={details.en}
        onChangeText={(text) => setDetails(prev => ({ ...prev, en: text }))}
        style={styles.input}
      />
      <TextInput
        placeholder="Description (French)"
        value={details.fr}
        onChangeText={(text) => setDetails(prev => ({ ...prev, fr: text }))}
        style={styles.input}
      />
      <TextInput
        placeholder="Description (Polish)"
        value={details.pl}
        onChangeText={(text) => setDetails(prev => ({ ...prev, pl: text }))}
        style={styles.input}
      />
      <TextInput
        placeholder="Description (German)"
        value={details.de}
        onChangeText={(text) => setDetails(prev => ({ ...prev, de: text }))}
        style={styles.input}
      />

      <TextInput
        placeholder="Price (USD)"
        value={price.USD}
        onChangeText={(text) => setPrice(prev => ({ ...prev, USD: text }))}
        style={styles.input}
        keyboardType="numeric"
      />
      <TextInput
        placeholder="Price (INR)"
        value={price.INR}
        onChangeText={(text) => setPrice(prev => ({ ...prev, INR: text }))}
        style={styles.input}
        keyboardType="numeric"
      />
      <TextInput
        placeholder="Price (EUR)"
        value={price.EUR}
        onChangeText={(text) => setPrice(prev => ({ ...prev, EUR: text }))}
        style={styles.input}
        keyboardType="numeric"
      />

      <TextInput
        placeholder="Size"
        value={nutritionalDetails.size}
        onChangeText={(text) => setNutritionalDetails(prev => ({ ...prev, size: text }))}
        style={styles.input}
      />
      <TextInput
        placeholder="Calories"
        value={nutritionalDetails.calories}
        onChangeText={(text) => setNutritionalDetails(prev => ({ ...prev, calories: text }))}
        style={styles.input}
      />
      <TextInput
        placeholder="Fat"
        value={nutritionalDetails.fat}
        onChangeText={(text) => setNutritionalDetails(prev => ({ ...prev, fat: text }))}
        style={styles.input}
      />
      <TextInput
        placeholder="Carbs"
        value={nutritionalDetails.carbs}
        onChangeText={(text) => setNutritionalDetails(prev => ({ ...prev, carbs: text }))}
        style={styles.input}
      />

      <TextInput
        placeholder="Proteins"
        value={nutritionalDetails.proteins}
        onChangeText={(text) => setNutritionalDetails(prev => ({ ...prev, proteins: text }))}
        style={styles.input}
      />
      <TextInput
        placeholder="Salt"
        value={nutritionalDetails.salt}
        onChangeText={(text) => setNutritionalDetails(prev => ({ ...prev, salt: text }))}
        style={styles.input}
      />

      <View style={styles.switchContainer}>
        <Text>Out of Stock</Text>
        <Switch
          value={isOutOfStock}
          onValueChange={setIsOutOfStock}
        />
      </View>
      <View style={{ marginBottom: 32 }}>
        <Button title="Pick Image" onPress={selectImage} />
        {imageUri && <Image source={{ uri: imageUri }} style={styles.image} />}
        <Button title="Create Product" onPress={handleSubmit} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  nutritionalDetailsContainer: {
    marginTop: 8,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  image: {
    width: 100,
    height: 100,
    marginVertical: 12,
  },
  productItem: {
    padding: 16,
    borderBottomColor: 'gray',
    borderBottomWidth: 1,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CreateProductScreen;
