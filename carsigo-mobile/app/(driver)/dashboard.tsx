import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Wallet, Bell, User, ArrowLeft } from 'lucide-react-native';
import RideRequestCard from '../../components/RideRequestCard';

// Mock Data para las solicitudes
const MOCK_REQUESTS = [
  { id: '1', distance: '1.2 km', offer: 3000, from: 'Calle 10 #45-20', to: 'C.C. El Tesoro', passengerName: 'Andrés López' },
  { id: '2', distance: '0.8 km', offer: 2500, from: 'Parque Poblado', to: 'Estación Aguacatala', passengerName: 'Maria Camila Rios' },
  { id: '3', distance: '2.5 km', offer: 7500, from: 'Viva Envigado', to: 'Parque Lleras, Poblado', passengerName: 'Carlos Castaño' },
];

export default function DriverDashboard() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header del Conductor */}
      <View className="bg-emerald-600 px-6 pt-10 pb-8 rounded-b-[32px] shadow-lg">
        <View className="flex-row justify-between items-center mb-6">
          <View className="flex-row items-center">
            <TouchableOpacity
              className="w-10 h-10 bg-emerald-500 rounded-full items-center justify-center mr-3 border border-emerald-400"
              onPress={() => router.back()}
            >
              <ArrowLeft size={20} color="white" />
            </TouchableOpacity>
            <View>
              <Text className="text-emerald-100 text-xs font-medium">Bienvenido,</Text>
              <Text className="text-white font-bold text-lg">Carlos Pérez</Text>
            </View>
          </View>
          <View className="bg-emerald-700/50 px-3 py-1.5 rounded-full flex-row items-center">
            <View className="w-2 h-2 bg-green-400 rounded-full mr-2" />
            <Text className="text-white text-xs font-bold uppercase">Conectado</Text>
          </View>
        </View>

        <View className="bg-white/10 p-5 rounded-3xl flex-row justify-between items-center border border-white/20">
          <View>
            <Text className="text-emerald-100 text-sm font-medium">Saldo Disponible</Text>
            <Text className="text-white text-3xl font-black tracking-tighter">$25,000 COP</Text>
          </View>
          <TouchableOpacity className="bg-white w-12 h-12 rounded-2xl items-center justify-center shadow-sm active:scale-95 transition-all">
            <Wallet size={24} color="#059669" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista de Solicitudes */}
      <View className="flex-1 px-6 mt-6">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-bold text-gray-800">Solicitudes Cercanas</Text>
          <View className="bg-blue-100 px-2 py-1 rounded border border-blue-200">
            <Text className="text-blue-700 text-xs font-bold">{MOCK_REQUESTS.length} nuevas</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {MOCK_REQUESTS.map((req) => (
            <RideRequestCard key={req.id} request={req} />
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
