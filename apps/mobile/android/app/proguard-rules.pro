# ProGuard/R8 rules para CarSiGo mobile
# Evita que se eliminen clases de Firebase y Google Maps

# Firebase Core / Auth / Firestore / Storage / Messaging / App Check
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class io.flutter.plugins.firebase.** { *; }
-dontwarn io.flutter.plugins.firebase.**

# Google Maps
-keep class com.google.android.gms.maps.** { *; }
-dontwarn com.google.android.gms.maps.**
-keep class com.google.maps.** { *; }
-dontwarn com.google.maps.**

# Keep names of methods called from JavaScript (method channels)
-keep class io.flutter.app.FlutterPluginRegistry { *; }
-dontwarn io.flutter.app.FlutterPluginRegistry.

# Keep native methods
-keepclasseswithmembers class * {
    native <methods>;
}

# Keep enums used in switch statements
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Keep model classes used by Firestore/JSON serialization
-keepclassmembers class * {
    @com.google.firebase.firestore.PropertyName *;
    @com.google.gson.annotations.SerializedName *;
}