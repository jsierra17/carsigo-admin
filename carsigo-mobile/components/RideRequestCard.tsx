import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MapPin, Navigation, User } from 'lucide-react-native';

interface Request {
  id: string;
  distance: string;
  offer: number;
  from: string;
  to: string;
  passengerName: string;
}

export default function RideRequestCard({ request }: { request: Request }) {
  return (
    <View className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-4">
      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center mr-3">
            <User size={20} color="#059669" />
          </View>
          <View>
            <Text className="text-gray-900 font-bold text-base">{request.passengerName}</Text>
            <View className="flex-row items-center mt-0.5">
              <Navigation size={12} color="#6b7280" className="mr-1" />
              <Text className="text-gray-500 text-xs font-medium">A {request.distance}</Text>
            </View>
          </View>
        </View>
        <View className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
          <Text className="text-emerald-700 font-extrabold text-lg">${request.offer.toLocaleString('es-CO')}</Text>
        </View>
      </View>

      <View className="mb-5 pl-2 relative">
        <View className="absolute left-[13px] top-[14px] bottom-[14px] w-[1px] bg-gray-200" />
        
        <View className="flex-row items-center mb-3">
          <View className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-3 z-10" />
          <Text className="text-gray-600 flex-1 font-medium" numberOfLines={1}>{request.from}</Text>
        </View>
        
        <View className="flex-row items-center">
          <MapPin size={12} color="#ef4444" className="mr-3 z-10" style={{ marginLeft: -1 }} />
          <Text className="text-gray-800 font-bold flex-1" numberOfLines={1}>{request.to}</Text>
        </View>
      </View>

      <View className="flex-row gap-x-3">
        <TouchableOpacity className="flex-1 bg-white border-2 border-emerald-500 py-3 rounded-2xl items-center active:scale-95 transition-all">
          <Text className="text-emerald-600 font-bold text-sm">Contraofertar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity className="flex-1 bg-emerald-500 shadow-md shadow-emerald-500/20 py-3 rounded-2xl items-center active:scale-95 transition-all">
          <Text className="text-white font-bold text-sm">Aceptar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
