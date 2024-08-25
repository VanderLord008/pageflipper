import { useEffect, useMemo, useRef, useState } from "react";
import {pageAtom, pages} from "./UI";
import { Bone, BoxGeometry, Color, Float32BufferAttribute, MeshStandardMaterial, Skeleton, SkinnedMesh, SRGBColorSpace, Uint16BufferAttribute, Vector3 } from "three";
import { roughness } from "three/examples/jsm/nodes/Nodes.js";
import { useCursor, useTexture } from "@react-three/drei";
import { useAtom } from "jotai";
import { useFrame } from "@react-three/fiber";
import { degToRad } from "three/src/math/MathUtils.js";
import { easing } from "maath";

const EASING_FACTOR=0.5;
const INSIDE_CURVE_STRENGTH=0.18;

const   PAGE_WIDTH = 1.28;
const   PAGE_HEIGHT = 1.71;
const   PAGE_DEPTH = 0.003;
const   PAGE_SEGMENTS = 30;
const   SEGMENT_WIDTH = PAGE_WIDTH/PAGE_SEGMENTS;

const pageGeometry = new BoxGeometry(
    PAGE_WIDTH,
    PAGE_HEIGHT,
    PAGE_DEPTH,
    PAGE_SEGMENTS,
    2
)



pageGeometry.translate(PAGE_WIDTH/2,0,0);

const position = pageGeometry.attributes.position;
const vertex = new Vector3();
const skinIndexes=[];
const skinWeights=[];

//all vertices
for (let i = 0; i < position.count; i++) {
    //get the vertex
    vertex.fromBufferAttribute(position,i);
    //get the x position of the vertex
    const x = vertex.x;

    //calculate the skin's index
    const skinIndex =  Math.max(0,Math.floor(x/SEGMENT_WIDTH));
    //calculate the skin's weight - value b/w 0 and 1
    let skinWeight= (x % SEGMENT_WIDTH)/SEGMENT_WIDTH;
    //set this index into the array
    skinIndexes.push(skinIndex,skinIndex+1,0,0);
    //set this weight into the array
    skinWeights.push(1-skinWeight,skinWeight,0,0)


}

pageGeometry.setAttribute(
    "skinIndex",new Uint16BufferAttribute(skinIndexes,4)
)
pageGeometry.setAttribute(
    "skinWeight", new Float32BufferAttribute(skinWeights,4)
)

const whiteColor= new Color("white");

const pageMaterials=[
    new MeshStandardMaterial({
        color:whiteColor
    }),
    new MeshStandardMaterial({
        color:"#111"
    }),
    new MeshStandardMaterial({
        color:whiteColor
    }),
    new MeshStandardMaterial({
        color:whiteColor
    })
]

pages.forEach(page=>{
    useTexture.preload(`/textures/${page.front}.jpg`)
    useTexture.preload(`/textures/${page.back}.jpg`)
    useTexture.preload(`/textures//demoRoughness.webp`)
})

const Page=({number,front,back,page,opened,bookClosed, ...props})=>{

    const [picture,picture2,pictureRoughness]=useTexture([
        `/textures/${front}.jpg`,
        `/textures/${back}.jpg`,
        ...(number===0 || number === pages.legth -1 ? 
            [`/textures/demoRoughness.webp`]
            :[]
        ),
    ])
    picture.colorSpace=picture2.colorSpace= SRGBColorSpace;

    const group=useRef();

    const skinnedMeshRef=useRef();

    const manualSkinnedMesh = useMemo(()=>{
        const bones =[];
        for(let i=0;i<=PAGE_SEGMENTS;i++){
            let bone = new Bone();
            bones.push(bone);
            if(i==0){
                bone.position.x=0;
            }
            else{
                bone.position.x=SEGMENT_WIDTH;
            }

            if(i>0){
                //attach the new bone to the previous bone 
                bones[i-1].add(bone)
            }

        }
        const skeleton = new Skeleton(bones);
        const materials = [...pageMaterials, 
            new MeshStandardMaterial({
                color:whiteColor,
                map:picture,
                ...(number===0?{
                    roughnessMap : pictureRoughness
                } :
                {
                    roughness:0.1
                }),
            }),
            new MeshStandardMaterial({
                color:whiteColor,
                map:picture2,
                ...(number===pages.legth-1?{
                    roughnessMap: pictureRoughness
                }:{
roughness:0.1
                }),
            })
        ];
        const mesh = new SkinnedMesh(pageGeometry,materials);
        mesh.castShadow=true;
        mesh.receiveShadow=true;
        mesh.frustumCulled=false;
        mesh.add(skeleton.bones[0]);
        mesh.bind(skeleton);
        return mesh;
    },[])
    useFrame((_,delta)=>{
        if(!skinnedMeshRef.current){
            return;
        }
        let targetRotation= opened? -Math.PI / 2 : Math.PI / 2;
        if(!bookClosed){
            targetRotation += degToRad(number*0.8)
        }


        const bones=skinnedMeshRef.current.skeleton.bones;
        

        for (let i = 0; i < bones.length; i++) {
            const target = i ===0?group.current:bones[i];
            const insideCurveIntensity= i<8?Math.sin(i*0.2+0.25):0;
            let rotationAngle= insideCurveIntensity*INSIDE_CURVE_STRENGTH*targetRotation;
            if(bookClosed){
                if(i==0){
                    rotationAngle=targetRotation
                }
                else{
                    rotationAngle=0;
                }
            }
            easing.dampAngle(
                target.rotation,
                "y",
                rotationAngle,
                EASING_FACTOR,
                delta
            )
        }
    });

    const [_,setPage]=useAtom(pageAtom);
    const [highlighted,setHighlighted]=useState(false);
    useCursor(highlighted);

    return (
        <group {...props} ref={group}
            onPointerEnter={(e)=>{
                e.stopPropagation();
                setHighlighted(true)
            }}
            onPointerLeave={(e)=>{
                e.stopPropagation();
                setHighlighted(false)
            }}       
            onClick={e=>{
                e.stopPropagation();
                setPage(opened?number:number+1);
                setHighlighted(false)
            }}
            >
            <primitive 
                object={manualSkinnedMesh} 
                ref={skinnedMeshRef}
                position-z={-number * PAGE_DEPTH + page * PAGE_DEPTH}
            />
        </group>
    )
}



export const Book=({...props})=>{
    const [page]=useAtom(pageAtom)
    const [delayedPage,setDelayedPage]=useState(page);
    useEffect(() => {
        let timeout;
        const goToPage = () => {
          setDelayedPage((delayedPage) => {
            if (page === delayedPage) {
              return delayedPage;
            } else {
              timeout = setTimeout(
                () => {
                  goToPage();
                },
                Math.abs(page - delayedPage) > 2 ? 50 : 150
              );
              if (page > delayedPage) {
                return delayedPage + 1;
              }
              if (page < delayedPage) {
                return delayedPage - 1;
              }
            }
          });
        };
        goToPage();
        return () => {
          clearTimeout(timeout);
        };
      }, [page]);

    return (
        <group {...props} >
            {
            [...pages].map((pageData,index)=>(
                
                <Page 
                
                key={index}
                page={delayedPage}
                number={index}
                opened={delayedPage>index}
                bookClosed={delayedPage===0 || delayedPage===pages.length}
                {...pageData} />
            ))}
        </group>
    )
}