// Run with groovy.ui.GroovyMain using the Groovy jar in the Gradle distribution.
def binding = new Binding([ext: [:]])
new GroovyShell(binding).evaluate(new File('scripts/android/signing-properties.gradle'))
def load = binding.ext.loadNh3dSigningProperties
def source = File.createTempFile('nh3d-signing-', '.properties')
try {
    [
        'C:\\Users\\james\\Android keystore\\keystore',
        'C:\\\\Users\\\\james\\\\Android keystore\\\\keystore',
        'C:/Users/james/Android keystore/keystore',
        'C:\\new\\test\\unicode\\release.jks'
    ].each { value ->
        source.setText('storeFile=' + value + '\nstorePassword=secret\\\\word\nkeyAlias=release-key\nkeyPassword=secret\\tword\n', 'ISO-8859-1')
        def result = load(source)
        assert result.storeFile == value.replaceAll(/\\+/, '/')
        assert result.storePassword == 'secret\\word'
        assert result.keyPassword == "secret\tword"
        assert result.keyAlias == 'release-key'
    }
    ['../android/key.jks', '/home/user/key.jks'].each { value ->
        source.text = 'storeFile=' + value
        assert load(source).storeFile == value
    }
    source.text = '# storeFile=C:\\ignored\n storeFile : C:\\new\\test.jks\n'
    assert load(source).storeFile == 'C:/new/test.jks'
    println 'Signing properties regression checks passed.'
} finally {
    source.delete()
}
