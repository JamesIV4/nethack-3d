#include "RuntimeControllerModels.h"
#include <cassert>
#include <cstring>
using P=crow::RuntimeControllerModels;
static int loads=0;
static XrResult XRAPI_PTR enumerate(XrSession,uint32_t n,uint32_t* count,XrRenderModelPathInfoFB* paths){*count=2;if(n){paths[0].path=1;paths[1].path=2;}return XR_SUCCESS;}
static XrResult XRAPI_PTR pathName(XrInstance,XrPath path,uint32_t,uint32_t* count,char* name){const char* s=path==1?"/model_fb/controller/right":"/model_fb/controller/left";strcpy(name,s);*count=strlen(s)+1;return XR_SUCCESS;}
static XrResult XRAPI_PTR props(XrSession,XrPath path,XrRenderModelPropertiesFB* p){p->modelKey=path;p->modelVersion=3;return XR_SUCCESS;}
static XrResult XRAPI_PTR load(XrSession,const XrRenderModelLoadInfoFB*,XrRenderModelBufferFB* b){loads++;b->bufferCountOutput=12;if(b->bufferCapacityInput){memset(b->buffer,0,12);memcpy(b->buffer,"glTF",4);}return XR_SUCCESS;}
int main(){P::Api api{enumerate,props,load,pathName};P::Models known;auto models=P::Load({}, {},api,known);assert(models[0].key==2&&models[1].key==1);assert(models[0].status=="ready"&&models[0].bytes.size()==12);assert(loads==4);known=models;models=P::Load({}, {},api,known);assert(models[0].unchanged&&models[1].unchanged&&loads==4);api.load=nullptr;assert(P::Load({}, {},api,known)[0].status=="unsupported");}
