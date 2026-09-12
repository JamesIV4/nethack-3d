plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.meta.spatial.plugin")
}

android {
    namespace = "com.nethack3d.quest"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.nethack3d.quest.uiproof"
        minSdk = 34
        targetSdk = 34
        versionCode = 3
        versionName = "0.2.1-rendering-fix"
        ndk { abiFilters += "arm64-v8a" }
    }

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    // npm run quest:stage owns this directory. Never serve the development server.
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/gameAssets"))
    androidResources { noCompress += listOf("wasm", "data", "bank") }
    packaging { resources.excludes += "META-INF/LICENSE" }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
    implementation("com.meta.spatial:meta-spatial-sdk:0.13.2")
    implementation("com.meta.spatial:meta-spatial-sdk-toolkit:0.13.2")
    implementation("com.meta.spatial:meta-spatial-sdk-vr:0.13.2")
    implementation("com.meta.spatial:meta-spatial-sdk-isdk:0.13.2")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.webkit:webkit:1.11.0")
}

spatial {
    allowUsageDataCollection.set(false)
    // The single panel is created in Kotlin; there is no Spatial Editor export.
}

val verifyBundledGame by tasks.registering {
    group = "verification"
    description = "Require the explicitly staged, fully bundled Quest web build."
    val bundle = layout.buildDirectory.dir("generated/gameAssets/game")
    inputs.dir(bundle)
    doLast {
        val root = bundle.get().asFile
        val required = listOf("index.html", "quest-ui-probe.html", "quest-build.json")
        val missing = required.filterNot { root.resolve(it).isFile }
        check(missing.isEmpty()) {
            "Quest game assets are missing (${missing.joinToString()}). Run npm run quest:sync from the repository root first."
        }
    }
}

tasks.named("preBuild") { dependsOn(verifyBundledGame) }
