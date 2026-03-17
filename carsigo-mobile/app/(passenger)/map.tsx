import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, ArrowLeft, Search } from 'lucide-react-native';

export default function PassengerMapScreen() {
  const router = useRouter();
  const [destination, setDestination] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

  return (
    <View className="flex-1 bg-gray-100">
      {/* Botón de Regreso (Superior) */}
      <SafeAreaView className="absolute top-10 left-5 z-20">
        <TouchableOpacity 
          className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-md"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Mapa Simulado */}
      <View className="flex-1 bg-gray-300 justify-center items-center">
        <View className="absolute inset-0 opacity-30">
          {/* Líneas simples para simular calles */}
          <View className="w-full h-[2px] bg-gray-500 absolute top-1/3" />
          <View className="w-full h-[2px] bg-gray-500 absolute top-2/3" />
          <View className="h-full w-[2px] bg-gray-500 absolute left-1/2" />
        </View>
        <MapPin size={40} color="#ef4444" />
        <Text className="mt-2 font-bold text-gray-600">Tu ubicación actual</Text>
      </View>

      {/* Tarjeta de Solicitud (Bottom Sheet) */}
      <View className="bg-white rounded-t-[40px] px-6 pt-6 pb-12 shadow-2xl">
        <View className="w-12 h-1 bg-gray-200 rounded-full self-center mb-6" />
        <Text className="text-2xl font-bold text-gray-800 mb-6">¿A dónde vamos?</Text>

        {!isRequesting ? (
          <>
            <View className="bg-gray-100 flex-row items-center px-4 py-3 rounded-2xl border border-gray-200 mb-6">
              <Search size={20} color="#9ca3af" className="mr-3" />
              <TextInput
                className="flex-1 text-base text-gray-700"
                placeholder="Ingresa tu destino..."
                value={destination}
                onChangeText={setDestination}
              />
            </View>

            <TouchableOpacity
              className={`py-4 rounded-2xl items-center shadow-sm ${destination ? 'bg-emerald-500' : 'bg-gray-300'}`}
              onPress={() => destination && setIsRequesting(true)}
              disabled={!destination}
            >
              <Text className="text-white font-bold text-lg">Solicitar viaje</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 items-center">
            <Text className="text-emerald-800 font-bold text-lg mb-1">Tarifa sugerida: $3,000 COP</Text>
            <View className="flex-row items-center mt-3">
              <ActivityIndicator color="#10b981" />
              <Text className="ml-3 text-emerald-600 font-medium">Buscando conductores...</Text>
            </View>
            <TouchableOpacity 
              className="mt-6 bg-white px-6 py-2 rounded-full border border-red-200"
              onPress={() => setIsRequesting(false)}
            >
              <Text className="text-red-500 font-bold">Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
