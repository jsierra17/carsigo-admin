import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Car, User, ArrowRight } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-emerald-500">
      <StatusBar style="light" />
      <View className="flex-1 px-6 justify-center items-center">
        {/* Logo / Icono de Carsigo */}
        <View className="w-24 h-24 bg-white rounded-3xl items-center justify-center mb-6 shadow-xl shadow-black/20">
          <Car size={48} color="#10b981" />
        </View>

        <Text className="text-5xl font-extrabold text-white mb-2 text-center tracking-tight">
          Carsigo
        </Text>
        <Text className="text-emerald-100 text-lg mb-12 text-center px-4 font-medium">
          Tu transporte local, confiable y al precio justo.
        </Text>

        {/* Botones de Selección de Rol */}
        <View className="w-full gap-y-4">
          <TouchableOpacity 
            className="w-full bg-white py-4 rounded-2xl flex-row items-center justify-between px-6 shadow-md active:scale-95 transition-all"
            onPress={() => router.push('/(passenger)/map')}
          >
            <View className="flex-row items-center">
              <User size={24} color="#10b981" className="mr-3" />
              <Text className="text-emerald-800 font-bold text-lg">Ingresar como Pasajero</Text>
            </View>
            <ArrowRight size={20} color="#10b981" />
          </TouchableOpacity>

          <TouchableOpacity 
            className="w-full bg-emerald-600 border border-emerald-400 py-4 rounded-2xl flex-row items-center justify-between px-6 active:scale-95 transition-all"
            onPress={() => router.push('/(driver)/dashboard')}
          >
            <View className="flex-row items-center">
              <Car size={24} color="#ffffff" className="mr-3" />
              <Text className="text-white font-bold text-lg">Postularse como Conductor</Text>
            </View>
            <ArrowRight size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="pb-8 px-8">
        <Text className="text-emerald-200 text-xs text-center">
          Al ingresar, aceptas los Términos de Servicio y la Política de Privacidad de Carsigo.
        </Text>
      </View>
    </SafeAreaView>
  );
}
