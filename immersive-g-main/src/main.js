import './styles.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

import Lenis from 'lenis'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

import vertexShader from './shaders/vertex.glsl'
import fragmentShader from './shaders/fragment.glsl'

import textVertexShader from './shaders/text/vertex.glsl'
import textFragmentShader from './shaders/text/fragment.glsl'


import { TrailTexture } from './TrailTexture.js'

import { Text } from 'troika-three-text'


gsap.registerPlugin(ScrollTrigger)

class ThreeScene {
  constructor() {
    this.lenis = new Lenis({ autoRaf: true })

    this.scroll = 0

    this.scene = new THREE.Scene()

    this.manager = this.setUpLoadingManager()

    this.canvasContainer = document.querySelector('.canvasContainer')
    this.width = this.canvasContainer.offsetWidth
    this.height = this.canvasContainer.offsetHeight

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.canvasContainer.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(35, this.width / this.height, 0.01, 1000)
    this.camera.position.set(0, 0, 10)

    this.textureLoader = new THREE.TextureLoader(this.manager)

    this.loader = new GLTFLoader(this.manager)
    this.draco = new DRACOLoader(this.manager)
    this.draco.setDecoderConfig({ type: 'js' })
    this.draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
    this.loader.setDRACOLoader(this.draco)


    this.trailTexture = new TrailTexture({
      size: 30,
      maxAge: 3000,
      radius: 0.2,
      intensity: 0.1,
      interpolate: 5,
      smoothing: 0,
      minForce: 0.1,
      velocityEffect: false
    })

    this.autoTrailTexture = new TrailTexture({
      size: 30,
      maxAge: 3000,
      radius: 0.25,
      intensity: 0.1,
      interpolate: 3,
      smoothing: 0,
      minForce: 0.1,
    })

    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.pointerPosition = new THREE.Vector2()


    this.mouseEvents()
    this.addObjects()
    this.resize()
    this.render()
    this.handleResize()
    this.handleSroll()
  }

  mouseEvents() {

    this.fboScene = new THREE.Scene()
    this.fboCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this.fboMaterial = new THREE.MeshBasicMaterial()
    this.fboMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fboMaterial)
    this.fboScene.add(this.fboMesh)

    const throttlePointerMove = (callback, limit) => {
      let wait = false
      return function (...args) {
        if (!wait) {
          callback.apply(this, args)
          wait = true
          setTimeout(() => { wait = false }, limit)
        }
      }
    }

    const onPointerMove = ({ clientX, clientY }) => {
      this.pointer.x = (clientX / this.width) * 2 - 1
      this.pointer.y = -(clientY / this.height) * 2 + 1


      this.raycaster.setFromCamera(this.pointer, this.fboCamera)
      const intersects = this.raycaster.intersectObject(this.fboMesh)

      if (intersects.length > 0) {
        const uv = intersects[0].uv
        this.trailTexture.addTouch(uv)
      }
    }

    window.addEventListener('pointermove', throttlePointerMove(onPointerMove, 100))

    const autoMove = () => {
      let start, end

      do {
        start = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 }
        end = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 }
      } while (Math.hypot(end.x - start.x, end.y - start.y) < 0.5 || Math.hypot(end.x - start.x, end.y - start.y) > 0.8)


      gsap.to(start, {
        delay: Math.random() * 2,
        x: end.x,
        y: end.y,
        duration: Math.random() * 2 + 1,
        ease: 'expo.inOut',
        onUpdate: () => {
          this.raycaster.setFromCamera(new THREE.Vector2(start.x, start.y), this.fboCamera)
          const intersects = this.raycaster.intersectObject(this.fboMesh)
          if (intersects.length > 0) {
            const uv = intersects[0].uv
            this.autoTrailTexture.addTouch(uv)
          }
        },
        onComplete: autoMove
      })


    }
    autoMove()

  }

  setUpLoadingManager() {
    const manager = new THREE.LoadingManager()
    const scroller = document.querySelector('.scroller')
    const loadingBar = document.querySelector('.loading-wrap .mid .loading-bar ')

    manager.onProgress = function (url, itemsLoaded, itemsTotal) {
      const progress = Math.round((itemsLoaded / itemsTotal) * 100)
      loadingBar.style.width = progress + '%'
    }

    manager.onLoad = () => {
      this.canvasContainer.classList.remove('hidden')
      setTimeout(() => {
        scroller.classList.add('loaded')
        setTimeout(() => window.dispatchEvent(new Event("resize")), 50)
      }, 1000)
    }

    return manager
  }

  addObjects() {

    this.time = {
      value: 0
    }

    this.uniforms = {
      opacity: { value: 1 },
      resolution: { value: new THREE.Vector2(this.width, this.height) },
      darkMode: { value: 0 },
      plasterStrength: { value: .5 },
      contrast: { value: 0.6 },
      plaster: { value: this.textureLoader.load('/plaster.jpg') },
      brightness: { value: 0.3 },
      touchTexture: { value: null },
      autoTouchTexture: { value: null },
    }


    this.loader.load('/model.glb', (gltf) => {

      this.model = gltf.scene

      gltf.scene.traverse((child) => {
        if (child.isMesh) {

          const material = new THREE.ShaderMaterial({
            uniforms: {
              ...this.uniforms,
              map: { value: child.material.map },
              emissive: { value: child.material.emissiveMap }
            },
            vertexShader,
            fragmentShader
          })

          child.material = material
          child.material.needsUpdate = true
        }

      })

      this.scene.add(gltf.scene)
    })



  }

  resize() {
    this.width = this.canvasContainer.offsetWidth
    this.height = this.canvasContainer.offsetHeight
    this.uniforms.resolution.value.set(this.width, this.height)
    this.renderer.setSize(this.width, this.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  handleResize() {
    window.addEventListener('resize', () => {
      this.resize()
    }, false)
  }

  handleSroll() {
    document.addEventListener('scroll', () => {
      this.camera.position.y = - scrollY / 1000
      const loadingWrap = document.querySelector('.loading-wrap')
      const title = document.querySelector('.scroller .title ')
      if (scrollY > 30) {
        loadingWrap.classList.add('hidden')
        title.classList.remove('hidden')
      } else {
        title.classList.add('hidden')
        loadingWrap.classList.remove('hidden')
      }
    })
  }

  render() {
    const clock = new THREE.Clock()
    const render = () => {
      requestAnimationFrame(render)
      const delta = clock.getDelta()

      this.time.value += delta

      this.trailTexture.update(delta)
      this.autoTrailTexture.update(delta)
      this.uniforms.touchTexture.value = this.trailTexture.texture
      this.uniforms.autoTouchTexture.value = this.autoTrailTexture.texture

      this.renderer.render(this.scene, this.camera)

    }
    render()
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ThreeScene()
})

// GitHub API Integration
async function fetchGitHubData() {
  try {
    // Fetch user data
    const userResponse = await fetch('https://api.github.com/users/sqldns');
    const userData = await userResponse.json();
    
    // Fetch repositories
    const reposResponse = await fetch('https://api.github.com/users/sqldns/repos?sort=updated&per_page=6');
    const reposData = await reposResponse.json();
    
    // Update stats
    document.getElementById('repo-count').textContent = userData.public_repos;
    document.getElementById('contribution-count').textContent = 'Loading...';
    document.getElementById('stars-count').textContent = 'Loading...';
    
    // Unsplash image categories for different project types
    const imageCategories = {
      web: 'web-development',
      game: 'game-development',
      mobile: 'mobile-app',
      ai: 'artificial-intelligence',
      data: 'data-science',
      other: 'technology'
    };
    
    // Update projects
    const projectsContainer = document.getElementById('projects-container');
    projectsContainer.innerHTML = await Promise.all(reposData.map(async (repo, index) => {
      // Determine image category based on repository name and description
      let category = 'other';
      const repoName = repo.name.toLowerCase();
      const repoDesc = (repo.description || '').toLowerCase();
      
      if (repoName.includes('web') || repoName.includes('frontend') || repoName.includes('backend')) {
        category = 'web';
      } else if (repoName.includes('game') || repoName.includes('unity') || repoName.includes('unreal')) {
        category = 'game';
      } else if (repoName.includes('mobile') || repoName.includes('app')) {
        category = 'mobile';
      } else if (repoName.includes('ai') || repoName.includes('ml')) {
        category = 'ai';
      } else if (repoName.includes('data')) {
        category = 'data';
      }
      
      // Fetch random Unsplash image for the category
      const unsplashResponse = await fetch(`https://source.unsplash.com/featured/?${imageCategories[category]}&sig=${index}`);
      const imageUrl = unsplashResponse.url;
      
      return `
        <div class="project-item">
          <div class="project-image">
            <img src="${imageUrl}" alt="${repo.name}">
          </div>
          <div class="project-content">
            <h3>${repo.name}</h3>
            <p>${repo.description || 'No description available'}</p>
            <div class="project-meta">
              <span>⭐ ${repo.stargazers_count}</span>
              <span>🔀 ${repo.forks_count}</span>
            </div>
            <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="project-link">
              View Project
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 17L17 7M17 7H8M17 7V16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
          </div>
        </div>
      `;
    })).then(html => html.join(''));
    
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
  }
}

// Initialize GitHub data
fetchGitHubData();