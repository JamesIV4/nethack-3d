package com.nethack3d.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.nethack3d.app.xr.VrShellPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VrShellPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
