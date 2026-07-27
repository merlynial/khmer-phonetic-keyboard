plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.pakrinha.khmerphonetic"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.pakrinha.khmerphonetic"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Debug-signed so `gradle assembleRelease` still produces something
            // installable; a real Play release would need its own keystore.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    // words.txt is 1.8 MB of lexicon; leaving it uncompressed would bloat the
    // APK for no gain, so let aapt compress it as usual.
    androidResources {
        noCompress += listOf<String>()
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    testImplementation("junit:junit:4.13.2")
}
