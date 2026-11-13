# Particle transport correction

This revision supersedes the photo-reveal behavior in the earlier recordings. The cursor transports actual portrait, ambient and ribbon particles through one viewport velocity field. Particles retain independent velocity and spring back after the wake decays. There is no photo mask or pointer-driven opacity erasure.

The portrait is the same live canvas before and during the transition into the opening projects; it travels into the cropped left-edge position. Project panels enter through perspective depth, with captions attached. The field continues flowing and remains interactive across the projects and contact.

Record with the production server on port 3000:

```
node scripts/record-motion.mjs fluid cursor
node scripts/record-motion.mjs fluid field
node scripts/record-motion.mjs fluid scroll
node scripts/record-motion.mjs fluid mode
```
