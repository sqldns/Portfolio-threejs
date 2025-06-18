import * as THREE from 'three'

function smoothAverage(current, measurement, smoothing = 0.9) {
    return measurement * smoothing + current * (1.0 - smoothing)
}

const easeCircleOut = (x) => Math.sqrt(1 - Math.pow(x - 1, 2))

export class TrailTexture {
    constructor({
        size = 64,
        maxAge = 750,
        radius = 0.2,
        intensity = 0.2,
        interpolate = 0,
        smoothing = 0,
        minForce = 0.3,
        velocityEffect = false,
        blend = 'screen',
        ease = easeCircleOut,
    } = {}) {
        this.size = size
        this.maxAge = maxAge
        this.radius = radius
        this.intensity = intensity
        this.ease = ease
        this.interpolate = interpolate
        this.smoothing = smoothing
        this.minForce = minForce
        this.blend = blend
        this.velocityEffect = velocityEffect

        this.trail = []
        this.force = 0
        this.lastUpdate = performance.now()
        this.frameId = null

        this.maxPoints = 1000
        this.pointDistanceThreshold = 0.01

        this.initTexture()
    }

    initTexture() {
        this.canvas = document.createElement('canvas')
        this.canvas.width = this.canvas.height = this.size
        this.ctx = this.canvas.getContext('2d')
        this.ctx.fillStyle = 'black'
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

        this.texture = new THREE.Texture(this.canvas)
        this.canvas.id = 'touchTexture'
        this.canvas.style.width = this.canvas.style.height = `${this.canvas.width}px`
    }

    update(delta) {
        if (!this.frameId) {
            this.frameId = requestAnimationFrame(() => {
                const now = performance.now()
                const timeDiff = now - this.lastUpdate
                
                this.clear()
                
                let i = this.trail.length
                while (i--) {
                    const point = this.trail[i]
                    point.age += timeDiff
                    if (point.age > this.maxAge) {
                        this.trail.splice(i, 1)
                    } else {
                        this.drawTouch(point)
                    }
                }

                if (this.texture) {
                    this.texture.needsUpdate = true
                }

                this.lastUpdate = now
                this.frameId = null
            })
        }
    }

    clear() {
        if (this.ctx) {
            this.ctx.globalCompositeOperation = 'source-over'
            this.ctx.fillStyle = 'black'
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
        }
    }

    addTouch(point) {
        const last = this.trail[this.trail.length - 1]
        const now = performance.now()

        if (last) {
            const dx = last.x - point.x
            const dy = last.y - point.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            if (distance < this.pointDistanceThreshold) {
                return
            }

            const force = Math.max(this.minForce, Math.min(distance * 100, 1))
            this.force = smoothAverage(force, this.force, this.smoothing)

            if (this.interpolate && distance > 0.02) {
                const lines = Math.min(Math.ceil(distance / 0.02), 5)
                if (lines > 1) {
                    for (let i = 1; i < lines; i++) {
                        if (this.trail.length >= this.maxPoints) {
                            this.trail.shift()
                        }
                        this.trail.push({
                            x: last.x - (dx / lines) * i,
                            y: last.y - (dy / lines) * i,
                            age: 0,
                            force,
                            timestamp: now
                        })
                    }
                }
            }
        }

        if (this.trail.length >= this.maxPoints) {
            this.trail.shift()
        }

        this.trail.push({ 
            x: point.x, 
            y: point.y, 
            age: 0, 
            force: this.force,
            timestamp: now
        })
    }

    drawTouch(point) {
        const pos = {
            x: point.x * this.size,
            y: (1 - point.y) * this.size,
        }

        let intensity = 1
        if (point.age < this.maxAge * 0.3) {
            intensity = this.ease(point.age / (this.maxAge * 0.3))
        } else {
            intensity = this.ease(1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7))
        }

        this.velocityEffect && (intensity *= point.force)

        if (this.ctx) {
            this.ctx.globalCompositeOperation = this.blend
            const radius = this.size * this.radius * intensity
            const grd = this.ctx.createRadialGradient(pos.x, pos.y, Math.max(0, radius * 0.25), pos.x, pos.y, Math.max(0, radius))
            grd.addColorStop(0, `rgba(255, 255, 255, ${this.intensity})`)
            grd.addColorStop(1, `rgba(0, 0, 0, 0.0)`)
            this.ctx.fillStyle = grd
            this.ctx.beginPath()
            this.ctx.arc(pos.x, pos.y, Math.max(0, radius), 0, Math.PI * 2)
            this.ctx.fill()
        }
    }
}
