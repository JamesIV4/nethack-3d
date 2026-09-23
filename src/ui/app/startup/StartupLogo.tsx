import type { CSSProperties } from "react";
import { commonStrings } from "../shared/translations";

const logoLayers = [
  `
  +$$&&&&&$;         :X$&&&&$X:                       :X$&&&&&$X;     :X&&&&&&&$+                               .;;+X$;                                               
    +X&&&&&$X          X&&&$+                           +X&&&$+:        xX&&&&+:                              .$&&&&&+:                                               
    :x&&&&&&&$:        X$&&X;                           ;X&&&$x.        +X&&&$x.                                X$&&$+:                                               
    :x&&&&&&&&$x       X&&&X;                   x&:     ;X&&&$X.        +X&&&$x.                                X$&&&x:                                               
    :x&&x&&&&&&&$      X&&&X:        _       .$&&+:     ;X&&&$x.        +X&&&$x.                                X$&&&x.                                               
    :X&&x;X&&&&&&&:    X&&&X:   :+$&&&&&+   :&&&&$Xxxx; ;X&&&$X;.:;::::.xX&&&$x.   ;+$&&&&$+        :;+XXXXx;:  X$&&$x.   .XXXX+                                      
    :X&&x::+&&&&&&&x   X$&&x:  X&&$;;X&&&$ ;$&&&&XXXX;  ;x$$$$&&&&&&&&&&&&$$$$x  +&$X+;+$&&&$.    :$&&$x++$&&$+ X$$$$+.   +$$+:                                       
    :X&$x:  ;$&$&&$&&  +$&&x: $&&x:  :X&&x+  $&&&;.     ;+XXXXXXXXXXXXXXXX$$$X+  :+:    ;$$$Xx   X&&$;:   .++:  xX$$X+. ;&$+:                                         
    :X$$x:   ;+$$$$$&&:;X$$+.;X&&x  +$$&&xx  $&&&+.     ;+XXX+;. .. .   ;xXXXX+        :$$$$X+  x$$$;;          xXXXX+:$$Xx;                                          
    :X$Xx:    .;$XXXX$&$XX$+.;X&&&$Xx;:      $&$$;.     :+Xxx+;.        ;xXXxx+    ;XXX++XXXX+  xXXX;:          +XxxxxX$XXxx;                                         
    :+Xx+:      ;XXXXXX&&xX+ ;;$$Xx:         $$XX;.     :+x+++;.        ;+x+++;  ;XX+:. ;xxxx+  +xxX++          +x+++::+XxX++:                                        
    :+X++:       :+xxxxxX+x; .;xXX$$:     ,  XXxX+:     :;x+++;.        ;+++++; ;xx++   ;x++++  ;+x+x++         +x+++:.:;++x++:                                       
    :;x++:        :;x+++++x;  :;+XX$&&$XXX;  ++xx&&X+x; :;+++;;.        ;+++++; ;;++xX;;xx++++: .;;++xXXx;:;;+: ;x+++:. :;+++++;                                      
    X$++X&+         :x++++x;   .::+X$$$+::   .;;XX$+::  xX;;;;+;        xx;;;;+: ::+++;:: ++;;;.  ::;++++x+::.  Xx;;;+:  .:++++++.                                    
  :+;;:::::;x+        ;++X+:       :;;;:        ::;:.  ;::::::::::;   .;::::::::::: ...    ::.       .:::::.  .;::::::::::  ::::::::                                   
                                                                                                                                                                      
                                                                                                                                                                      
                                            ;&&&&&&&&&&&&&&&&&&x   x&&&&&&&&&&&&&$X+:.                                                                                
                                            :;&&&&&&&&&&&&&&&&+:   :;&&&&&$&&&&&&&&&&&&+                                                                              
                                            ;+:::::::::$&&&&$:.    :+&&&&&:.    ::&&&&&&$;                                                                            
                                                      $&&&&X:.      ;X&&&&&:.     :;$&&&&&&                                                                           
                                                    $&&&&X;:;+;:    +$&&&&&:.      ++&&&&&XX                                                                           
                                                  :X$$$$&&&&&&&&&+  ;x&&&&&:.      +X&&&&&+x                                                                           
                                                        .:X&&&&&&$; :+$$$$$:.      +X&$$$&++                                                                           
                                                          :+$$$$$:: :;XxxxX..      xxXXxxX;+                                                                           
                                                          :;XxxxX.. .:x+++x..     :+X++++::                                                                            
                                            x&+         :XX;;;;;.   :+;;;+.     XXx;;;+::                                                                             
                                            :;xx$&&$$XXX$X;:::;:.   .;+;;;++&$&&&x;;;+;:                                                                               
                                             ::::::;;;;;::::::      x+;:::;;;;:::::::                                                                                  
                                                                      `,
  `
  +$$&&&&&$;         :X$&&&&$X:                       :X$&&&&&$X;     :X&&&&&&&$+                               .;;+X$;                                               
    +X&&&&&$X          X&&&$+                           +X&&&$+:        xX&&&&+:                              .$&&&&&+:                                               
    :x&&&&&&&$:        X$&&X;                           ;X&&&$x.        +X&&&$x.                                X$&&$+:                                               
    :x&&&&&&&&$x       X&&&X;                   x&:     ;X&&&$X.        +X&&&$x.                                X$&&&x:                                               
    :x&&x&&&&&&&$      X&&&X:        _       .$&&+:     ;X&&&$x.        +X&&&$x.                                X$&&&x.                                               
    :X&&x;X&&&&&&&:    X&&&X:   :+$&&&&&+   :&&&&$Xxxx; ;X&&&$X;.:;::::.xX&&&$x.   ;+$&&&&$+        :;+XXXXx;:  X$&&$x.   .XXXX+                                      
    :X&&x::+&&&&&&&x   X$&&x:  X&&$;;X&&&$ ;$&&&&XXXX;  ;x$$$$&&&&&&&&&&&&$$$$x  +&$X+;+$&&&$.    :$&&$x++$&&$+ X$$$$+.   +$$+:                                       
    :X&$x:  ;$&$&&$&&  +$&&x: $&&x:  :X&&x+  $&&&;.     ;+XXXXXXXXXXXXXXXX$$$X+  :+:    ;$$$Xx   X&&$;:   .++:  xX$$X+. ;&$+:                                         
    :X$$x:   ;+$$$$$&&:;X$$+.;X&&x  +$$&&xx  $&&&+.     ;+XXX+;. .. .   ;xXXXX+        :$$$$X+  x$$$;;          xXXXX+:$$Xx;                                          
    :X$Xx:    .;$XXXX$&$XX$+.;X&&&$Xx;:      $&$$;.     :+Xxx+;.        ;xXXxx+    ;XXX++XXXX+  xXXX;:          +XxxxxX$XXxx;                                         
    :+Xx+:      ;XXXXXX&&xX+ ;;$$Xx:         $$XX;.     :+x+++;.        ;+x+++;  ;XX+:. ;xxxx+  +xxX++          +x+++::+XxX++:                                        
    :+X++:       :+xxxxxX+x; .;xXX$$:     ,  XXxX+:     :;x+++;.        ;+++++; ;xx++   ;x++++  ;+x+x++         +x+++:.:;++x++:                                       
    :;x++:        :;x+++++x;  :;+XX$&&$XXX;  ++xx&&X+x; :;+++;;.        ;+++++; ;;++xX;;xx++++: .;;++xXXx;:;;+: ;x+++:. :;+++++;                                      
    X$++X&+         :x++++x;   .::+X$$$+::   .;;XX$+::  xX;;;;+;        xx;;;;+: ::+++;:: ++;;;.  ::;++++x+::.  Xx;;;+:  .:++++++.                                    
  :+;;:::::;x+        ;++X+:       :;;;:        ::;:.  ;::::::::::;   .;::::::::::: ...    ::.       .:::::.  .;::::::::::  ::::::::                                   
                                                                                                                                                                      
                                                                                                                                                                      
                                            ;&&&&&&&&&&&&&&&&&&x   x&&&&&&&&&&&&&$X+:.                                                                                
                                            :;&&&&&&&&&&&&&&&&+:   :;&&&&&$&&&&&&&&&&&&+                                                                              
                                            ;+:::::::::$&&&&$:.    :+&&&&&:.    ::&&&&&&$;                                                                            
                                                      $&&&&X:.      ;X&&&&&:.     :;$&&&&&&                                                                            
                                                    $&&&&X;:;+;:    +$&&&&&:.      ++&&&&&XX                                                                           
                                                  :X$$$$&&&&&&&&&+  ;x&&&&&:.      +X&&&&&+x                                                                           
                                                        .:X&&&&&&$; :+$$$$$:.      +X&$$$&++                                                                           
                                                          :+$$$$$:: :;XxxxX..      xxXXxxX;+                                                                           
                                                          :;XxxxX.. .:x+++x..     :+X++++::                                                                            
                                            x&+         :XX;;;;;.   :+;;;+.     XXx;;;+::                                                                             
                                            :;xx$&&$$XXX$X;:::;:.   .;+;;;++&$&&&x;;;+;:                                                                               
                                             ::::::;;;;;::::::      x+;:::;;;;:::::::                                                                                  
                                                                      `
];

// Preserve desktop's original spacing, but give VR the visible art's bounds.
const logoLayouts = logoLayers.map(logo => {
  const rows = logo.split("\n");
  const ink = rows.filter(row => row.trim().length > 0);
  const left = Math.min(...ink.map(row => row.length - row.trimStart().length));
  const right = Math.max(...ink.map(row => row.trimEnd().length));
  return { rows, left, width: right - left };
});

export interface StartupLogoProps {
  asciiLogoVisible: boolean;
}

export function StartupLogo({ asciiLogoVisible }: StartupLogoProps) {
  if (!asciiLogoVisible) return null;
  return (
    <div className="logo-container" role="img" aria-label={commonStrings.appName}>
      {logoLayouts.map(({ rows, left, width }, layer) => {
        return <pre className="nethack-ascii-logo" aria-hidden="true" key={layer}
          style={{ "--nh3d-logo-ink-left": `${left}ch`, "--nh3d-logo-ink-width": `${width}ch` } as CSSProperties}>
          {rows.map((row, index) => <span className="nh3d-logo-row" key={index}
            style={{ "--nh3d-logo-wave-delay": `${index * 4.5 / Math.max(1, rows.length - 1)}s` } as CSSProperties}>
            {row || " "}
          </span>)}
        </pre>;
      })}
    </div>
  );
}
