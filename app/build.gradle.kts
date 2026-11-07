plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Kunci rilis TIDAK pernah ada di repository. Workflow GitHub Actions mengisinya dari GitHub Secrets
// lewat environment variable. Tanpa variable ini, build release tidak ditandatangani dan workflow menolaknya.
val releaseKeystorePath: String? = System.getenv("C01N_KEYSTORE_PATH")

android {
    namespace = "com.c01n.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.c01n.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "1.0.0"
    }

    signingConfigs {
        create("release") {
            if (releaseKeystorePath != null) {
                storeFile = file(releaseKeystorePath)
                storePassword = System.getenv("C01N_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("C01N_KEY_ALIAS")
                keyPassword = System.getenv("C01N_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            isDebuggable = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (releaseKeystorePath != null) signingConfigs.getByName("release") else null
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}
