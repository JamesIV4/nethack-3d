// AGP and Spatial versions follow Meta's StarterSample.
// Spatial Gradle plugin 0.13.2 exports kotlin-compiler-embeddable 2.2.0 onto
// the build classpath. Keep KGP aligned to avoid IncrementalCompilationFeatures
// linkage failures; the sample catalog's older Kotlin 2.1.0 is incompatible.
plugins {
    id("com.android.application") version "8.11.1" apply false
    id("org.jetbrains.kotlin.android") version "2.2.0" apply false
    id("com.meta.spatial.plugin") version "0.13.2" apply false
}
